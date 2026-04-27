'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { BaseYearSnapshot, StructuralChangeType } from '@/types/database'

interface ActionResult {
  ok: boolean
  error?: string
  recalculationId?: string
}

interface RawEntry {
  scope: string | null
  scope2_method: string | null
  tco2e: number | null
}

/**
 * Calcula los totales por scope/method para un set de entries.
 * Misma convención que el dashboard: location-based como headline.
 *
 * No-export: en un archivo `'use server'` todo `export function` debe ser
 * server action (async). Esta es síncrona y privada al módulo.
 */
function computeSnapshot(entries: RawEntry[]): BaseYearSnapshot {
  const s1 = entries.filter((e) => e.scope === 's1').reduce((s, e) => s + (e.tco2e ?? 0), 0)
  const s3 = entries.filter((e) => e.scope === 's3').reduce((s, e) => s + (e.tco2e ?? 0), 0)
  const s2_location = entries
    .filter((e) => e.scope === 's2' && (e.scope2_method === 'location_based' || e.scope2_method == null))
    .reduce((s, e) => s + (e.tco2e ?? 0), 0)
  const s2_market = entries
    .filter((e) => e.scope === 's2' && e.scope2_method === 'market_based')
    .reduce((s, e) => s + (e.tco2e ?? 0), 0)
  return {
    s1,
    s2_location,
    s2_market,
    s3,
    total_location: s1 + s2_location + s3,
    total_market: s1 + s2_market + s3,
  }
}

/**
 * Propone un recálculo del año base.
 *
 *  · pre_snapshot = último `applied` snapshot guardado (o el actual si no hay).
 *  · post_snapshot = estado actual del inventario del base year.
 *  · delta_pct = ((post - pre) / pre) * 100 sobre total_location.
 *
 * No modifica los emission_entries; solo registra el evento estructural y el
 * diff. El admin debe luego "Apply" para marcarlo como aceptado.
 */
export async function proposeRecalculation(input: {
  structural_change_type: StructuralChangeType
  reason: string
}): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || profile.role !== 'admin') {
    return { ok: false, error: 'Solo admins pueden proponer recálculos.' }
  }
  if (!profile.organization_id) return { ok: false, error: 'Sin organización.' }

  const { data: org } = await supabase
    .from('organizations')
    .select('base_year, recalc_threshold_pct')
    .eq('id', profile.organization_id)
    .maybeSingle()
  if (!org?.base_year) {
    return { ok: false, error: 'Sin año base configurado. Fíjalo primero.' }
  }

  // Inventario del base year — puede no existir si se eliminó después del lock.
  const { data: inv } = await supabase
    .from('ghg_inventories')
    .select('id, emission_entries(scope, scope2_method, tco2e)')
    .eq('organization_id', profile.organization_id)
    .eq('fiscal_year', org.base_year)
    .maybeSingle()

  if (!inv) {
    return {
      ok: false,
      error: `No se encuentra inventario para el año base ${org.base_year}.`,
    }
  }

  const entries = (inv.emission_entries ?? []) as RawEntry[]
  const post = computeSnapshot(entries)

  // Pre = último snapshot post de un recálculo aplicado. Si no hay, pre = post (delta 0).
  const { data: lastApplied } = await supabase
    .from('base_year_recalculations')
    .select('post_recalc_snapshot')
    .eq('organization_id', profile.organization_id)
    .eq('applied', true)
    .order('applied_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const pre: BaseYearSnapshot =
    (lastApplied?.post_recalc_snapshot as BaseYearSnapshot) ?? post

  const deltaPct =
    pre.total_location > 0
      ? ((post.total_location - pre.total_location) / pre.total_location) * 100
      : 0

  const { data: inserted, error } = await supabase
    .from('base_year_recalculations')
    .insert({
      organization_id: profile.organization_id,
      target_base_year: org.base_year,
      structural_change_type: input.structural_change_type,
      reason: input.reason.trim(),
      pre_recalc_snapshot: pre,
      post_recalc_snapshot: post,
      delta_pct: deltaPct,
      threshold_pct_at_time: Number(org.recalc_threshold_pct ?? 5),
      proposed_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  revalidatePath('/settings/base-year')
  return { ok: true, recalculationId: inserted.id }
}

/** Marca un recálculo como aplicado. No revierte ni edita los datos. */
export async function applyRecalculation(
  id: string,
  notes?: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado.' }

  const { error } = await supabase
    .from('base_year_recalculations')
    .update({
      applied: true,
      applied_at: new Date().toISOString(),
      applied_by: user.id,
      applied_notes: notes?.trim() || null,
    })
    .eq('id', id)
    .eq('applied', false)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/settings/base-year')
  return { ok: true }
}
