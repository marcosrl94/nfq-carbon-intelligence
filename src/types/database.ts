export type UserRole = 'admin' | 'analyst' | 'client' | 'auditor'
export type InventoryStatus = 'draft' | 'submitted' | 'verified'
export type Scope = 's1' | 's2' | 's3'
export type DisclosureFramework = 'TCFD' | 'ESRS' | 'AMBOS'
export type EmissionFactorSource = 'MITECO' | 'IDAE' | 'DEFRA'

export interface Organization {
  id: string
  name: string
  sectors: string[]
  geographies: string[]
  consolidation: string
  employees: number | null
  revenue_eur_m: number | null
  fiscal_year: number
  /** RLS: permite leer la org creada en bootstrap (ensureUserProfile). */
  created_by_user_id?: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  organization_id: string | null
  role: UserRole
  full_name: string | null
  email: string | null
  created_at: string
}

export interface GHGInventory {
  id: string
  organization_id: string
  fiscal_year: number
  ef_source: string
  status: InventoryStatus
  submitted_at: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface EmissionEntry {
  id: string
  inventory_id: string
  scope: Scope
  category: string | null
  subcategory: string | null
  quantity: number | null
  unit: string | null
  ef_value: number | null
  ef_source: string | null
  tco2e: number | null
  /** FK opcional al catálogo de factores (20250424140000_emission_factors.sql). */
  factor_id: string | null
  created_at: string
  updated_at: string
}

/**
 * Catálogo de factores de emisión (read-only para la app).
 *
 * Semántica:
 *   tCO2e = quantity * ef_value / 1000
 *   · ef_value = kgCO2e / 1 unidad(ef_unit)
 *   · unit     = 'kgCO2e' (numerador; se deja por claridad)
 *   · ef_unit  = denominador (kWh, L, km, kg, m3, pkm, vkm…)
 *
 * Migraciones:
 *   · 20250424150000_emission_factors.sql       (tabla + RLS)
 *   · 20250424150100_emission_factors_seed.sql  (seed MITECO/IDAE/DEFRA)
 */
export interface EmissionFactor {
  id: string
  /** Clave estable para seed idempotente y referencias programáticas. */
  activity_key: string
  source: EmissionFactorSource
  /** ej: 'DEFRA 2024 v1.0', 'IDAE Factores 2023'. */
  source_version: string | null
  scope: Scope
  category: string
  subcategory: string | null
  activity_label: string
  unit: string
  ef_value: number
  ef_unit: string
  /** ISO-3166 alpha-2 ('ES', 'UK'…), 'EU27' o 'GLOBAL'. */
  region: string
  year: number
  citation_url: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DecarbTarget {
  id: string
  organization_id: string
  framework: string | null
  target_year: number | null
  reduction_s1: number | null
  reduction_s2: number | null
  reduction_s3: number | null
  curve_type: string
  levers: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface RegulatoryDisclosure {
  id: string
  inventory_id: string
  framework: DisclosureFramework
  disclosure_id: string
  content: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface AuditLogEntry {
  id: number
  organization_id: string | null
  user_id: string | null
  action: string
  payload: Record<string, unknown> | null
  created_at: string
}

export interface Invitation {
  id: string
  organization_id: string | null
  email: string
  role: UserRole
  token: string
  accepted: boolean
  expires_at: string
  created_at: string
}
