/**
 * Resolución de materialidad efectiva por sector × scope/categoría.
 *
 * Orden de preferencia:
 *   1. Override per-organization (org_materiality_overrides) — siempre gana.
 *   2. Match exacto en industry_materiality.
 *   3. Si el sector es una división (e.g. 'C.10'), fallback a la sección padre ('C').
 *   4. Si nada coincide, level=0, source='inherit'.
 *
 * Nota: hay 11 categorías clave sembradas (s1, s2, s3.cat1, cat3, cat4, cat5,
 * cat6, cat7, cat11, cat15). Otras categorías quedan en 0 por defecto.
 */

import type {
  IndustryMateriality,
  MaterialityFramework,
  MaterialityLevel,
  OrgMaterialityOverride,
  ScopeCategory,
} from '@/types/database'

export type MaterialitySource = 'override' | MaterialityFramework | 'inherit'

export interface ResolvedMateriality {
  level: MaterialityLevel
  source: MaterialitySource
  notes: string | null
  /** Sector que aportó el valor (si fue por inheritance, será el padre). */
  resolved_from: string
}

export function resolveMateriality(
  sectorCode: string,
  scopeCategory: ScopeCategory,
  catalog: IndustryMateriality[],
  overrides: OrgMaterialityOverride[]
): ResolvedMateriality {
  // 1. Override directo
  const override = overrides.find(
    (o) => o.sector_code === sectorCode && o.scope_category === scopeCategory
  )
  if (override) {
    return {
      level: override.materiality,
      source: 'override',
      notes: override.justification,
      resolved_from: sectorCode,
    }
  }

  // 2. Match exacto. Si hay varios frameworks para el mismo (sector,scope), priorizamos
  // EFRAG_ESRS > GHG_Protocol > SASB > NFQ_internal.
  const directMatches = catalog.filter(
    (m) => m.sector_code === sectorCode && m.scope_category === scopeCategory
  )
  if (directMatches.length > 0) {
    const order: MaterialityFramework[] = ['EFRAG_ESRS', 'GHG_Protocol', 'SASB', 'NFQ_internal']
    const sorted = [...directMatches].sort(
      (a, b) => order.indexOf(a.source_framework) - order.indexOf(b.source_framework)
    )
    const winner = sorted[0]
    return {
      level: winner.materiality,
      source: winner.source_framework,
      notes: winner.notes,
      resolved_from: sectorCode,
    }
  }

  // 3. Fallback a la sección padre si es división
  if (sectorCode.includes('.')) {
    const parentCode = sectorCode.split('.')[0]
    const parentMatches = catalog.filter(
      (m) => m.sector_code === parentCode && m.scope_category === scopeCategory
    )
    if (parentMatches.length > 0) {
      const order: MaterialityFramework[] = ['EFRAG_ESRS', 'GHG_Protocol', 'SASB', 'NFQ_internal']
      const sorted = [...parentMatches].sort(
        (a, b) => order.indexOf(a.source_framework) - order.indexOf(b.source_framework)
      )
      const winner = sorted[0]
      return {
        level: winner.materiality,
        source: 'inherit',
        notes: winner.notes,
        resolved_from: parentCode,
      }
    }
  }

  return { level: 0, source: 'inherit', notes: null, resolved_from: sectorCode }
}

/**
 * Entry mínimo necesario para hotspot detection.
 * Lo cargamos vía embed `emission_factors(s3_category)` en el server query.
 *
 * Supabase devuelve el embed como array por defecto (incluso para FK 1:1)
 * salvo que se anote como single. Aceptamos ambos formatos.
 */
type EmissionFactorEmbed = { s3_category: number | null }
export interface HotspotEntry {
  scope: string | null
  tco2e: number | null
  emission_factors?: EmissionFactorEmbed | EmissionFactorEmbed[] | null
  /** Snapshot directo si ya está denormalizado en la entry (futuro). */
  s3_category?: number | null
}

export interface Hotspot {
  sectorCode: string
  scopeCategory: ScopeCategory
  level: MaterialityLevel
  /** True si caemos en agregado S3 (la entry no tiene factor.s3_category). */
  uncertain: boolean
}

/** Extrae la categoría S3 1-15 de una entry, devolviendo null si no se puede determinar. */
function entryS3Cat(e: HotspotEntry): number | null {
  if (e.s3_category != null) return e.s3_category
  const ef = e.emission_factors
  if (!ef) return null
  if (Array.isArray(ef)) return ef[0]?.s3_category ?? null
  return ef.s3_category ?? null
}

/**
 * Detecta hotspots: cruces (sector × scope/categoría) con materialidad ≥ 2
 * que no tienen tCO2e > 0 en el inventario actual.
 *
 * Para S3, evalúa la categoría 1-15 individualmente si la entry tiene
 * `factor.s3_category`; si no, cae en agregado (uncertain=true) — significa
 * que la entry tiene scope=s3 sin factor mapeado, no podemos garantizar
 * que cubre la categoría del sector.
 */
export function detectHotspots(
  orgSectors: string[],
  entries: HotspotEntry[],
  catalog: IndustryMateriality[],
  overrides: OrgMaterialityOverride[]
): Hotspot[] {
  const hasS1 = entries.some((e) => e.scope === 's1' && (e.tco2e ?? 0) > 0)
  const hasS2 = entries.some((e) => e.scope === 's2' && (e.tco2e ?? 0) > 0)

  // Para S3, indexamos por categoría: hasS3Cat[X] = true si hay alguna entry
  // s3 con tco2e>0 cuyo factor.s3_category === X.
  const hasS3Cat = new Map<number, boolean>()
  let hasS3Unmapped = false // entries s3 sin factor.s3_category
  for (const e of entries) {
    if (e.scope !== 's3') continue
    if ((e.tco2e ?? 0) <= 0) continue
    const cat = entryS3Cat(e)
    if (cat != null) hasS3Cat.set(cat, true)
    else hasS3Unmapped = true
  }

  const out: Hotspot[] = []
  for (const sectorCode of orgSectors) {
    for (const sc of SCOPE_CATEGORIES_ORDER) {
      const r = resolveMateriality(sectorCode, sc, catalog, overrides)
      if (r.level < 2) continue
      let covered: boolean
      let uncertain = false
      if (sc === 's1') covered = hasS1
      else if (sc === 's2') covered = hasS2
      else {
        // s3.catX
        const match = sc.match(/^s3\.cat(\d+)$/)
        const targetCat = match ? Number(match[1]) : null
        if (targetCat == null) covered = false
        else {
          const directCovered = hasS3Cat.get(targetCat) === true
          covered = directCovered
          // Si no hay match directo PERO hay entries S3 sin mapping, marcamos
          // uncertain (no podemos descartar que la cubran).
          if (!directCovered && hasS3Unmapped) uncertain = true
        }
      }
      if (!covered) {
        out.push({ sectorCode, scopeCategory: sc, level: r.level, uncertain })
      }
    }
  }
  return out
}

/** Ordering canónico para mostrar en UI. */
export const SCOPE_CATEGORIES_ORDER: ScopeCategory[] = [
  's1',
  's2',
  's3.cat1',
  's3.cat3',
  's3.cat4',
  's3.cat5',
  's3.cat6',
  's3.cat7',
  's3.cat11',
  's3.cat15',
]

export const SCOPE_CATEGORY_LABELS: Record<ScopeCategory, string> = {
  s1: 'S1 · Directas',
  s2: 'S2 · Electricidad',
  's3.cat1': 'S3.1 · Bienes y servicios',
  's3.cat2': 'S3.2 · Bienes capital',
  's3.cat3': 'S3.3 · Combustibles y energía (WTT)',
  's3.cat4': 'S3.4 · Transporte upstream',
  's3.cat5': 'S3.5 · Residuos operacionales',
  's3.cat6': 'S3.6 · Viajes de negocio',
  's3.cat7': 'S3.7 · Desplazamiento empleados',
  's3.cat8': 'S3.8 · Activos arrendados upstream',
  's3.cat9': 'S3.9 · Transporte downstream',
  's3.cat10': 'S3.10 · Procesado productos vendidos',
  's3.cat11': 'S3.11 · Uso productos vendidos',
  's3.cat12': 'S3.12 · End-of-life productos vendidos',
  's3.cat13': 'S3.13 · Activos arrendados downstream',
  's3.cat14': 'S3.14 · Franquicias',
  's3.cat15': 'S3.15 · Inversiones (PCAF)',
}
