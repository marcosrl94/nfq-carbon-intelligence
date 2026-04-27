'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface OrphanBlob {
  name: string
  size: number
  created_at: string
}

interface ListResult {
  ok: boolean
  orphans?: OrphanBlob[]
  totalAttachments?: number
  error?: string
}

interface PurgeResult {
  ok: boolean
  orphansRemoved?: number
  error?: string
}

/**
 * Lista blobs huérfanos del bucket evidence para la org del admin actual.
 * Usa la función SQL list_orphan_evidence_blobs() (security definer con
 * filtrado por org_id internamente).
 */
export async function listOrphanedEvidenceBlobs(): Promise<ListResult> {
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
  if (profile?.role !== 'admin') return { ok: false, error: 'Sólo admins.' }

  const { data: orphans, error } = await supabase.rpc('list_orphan_evidence_blobs')
  if (error) return { ok: false, error: error.message }

  // Total de attachments registrados (para mostrar contexto en la UI)
  const { count } = await supabase
    .from('evidence_attachments')
    .select('id', { count: 'exact', head: true })

  return {
    ok: true,
    orphans: (orphans ?? []) as OrphanBlob[],
    totalAttachments: count ?? 0,
  }
}

/**
 * Borra TODOS los blobs huérfanos del bucket evidence para la org del admin.
 * Operación idempotente — si los archivos ya no existen no falla.
 *
 * Procesamiento por lotes de 100 paths para no toparse con límites del
 * endpoint de Storage. Si un batch falla, devuelve el progreso parcial.
 */
export async function purgeOrphanedEvidenceBlobs(): Promise<PurgeResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') return { ok: false, error: 'Sólo admins.' }

  const { data: orphans, error: lErr } = await supabase.rpc('list_orphan_evidence_blobs')
  if (lErr) return { ok: false, error: lErr.message }
  if (!orphans || orphans.length === 0) {
    revalidatePath('/admin/storage')
    return { ok: true, orphansRemoved: 0 }
  }

  const paths = (orphans as OrphanBlob[]).map((o) => o.name)
  const BATCH = 100
  let removed = 0
  for (let i = 0; i < paths.length; i += BATCH) {
    const batch = paths.slice(i, i + BATCH)
    const { error: rErr } = await supabase.storage.from('evidence').remove(batch)
    if (rErr) {
      revalidatePath('/admin/storage')
      return {
        ok: false,
        error: `Falló batch ${i + 1}-${i + batch.length}: ${rErr.message}`,
        orphansRemoved: removed,
      }
    }
    removed += batch.length
  }

  revalidatePath('/admin/storage')
  return { ok: true, orphansRemoved: removed }
}
