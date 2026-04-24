import { createClient } from '@/lib/supabase/server'
import type { EmissionFactor, Scope } from '@/types/database'

/**
 * Lista el catálogo de factores de emisión (read-only).
 * Ordenado por (scope, category, activity_label) para consumo directo en selectores.
 */
export async function listEmissionFactors(options?: {
  scope?: Scope
  source?: string
}): Promise<EmissionFactor[]> {
  const supabase = await createClient()
  let query = supabase
    .from('emission_factors')
    .select('*')
    .order('scope', { ascending: true })
    .order('category', { ascending: true })
    .order('activity_label', { ascending: true })

  if (options?.scope) query = query.eq('scope', options.scope)
  if (options?.source) query = query.eq('source', options.source)

  const { data, error } = await query
  if (error) {
    console.error('[listEmissionFactors]', error)
    return []
  }
  return (data ?? []) as EmissionFactor[]
}

/**
 * Calcula tCO2e desde (quantity, ef_value). El factor viene en kgCO2e por 1 unit,
 * por eso dividimos entre 1000. Devuelve null si falta alguno.
 */
export function computeTco2e(quantity: number | null | undefined, efValue: number | null | undefined): number | null {
  if (quantity == null || efValue == null) return null
  if (Number.isNaN(quantity) || Number.isNaN(efValue)) return null
  return (Number(quantity) * Number(efValue)) / 1000
}
