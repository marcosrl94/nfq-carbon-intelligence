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
