export type UserRole = 'admin' | 'analyst' | 'client' | 'auditor'
export type InventoryStatus = 'draft' | 'submitted' | 'verified'
export type Scope = 's1' | 's2' | 's3'
export type DisclosureFramework = 'TCFD' | 'ESRS' | 'AMBOS'
export type EmissionFactorSource = 'MITECO' | 'IDAE' | 'DEFRA'
/**
 * ESRS/CSRD data quality tier por entrada.
 *   1 = primary activity + supplier-specific EF
 *   2 = primary activity + generic catalog EF (caso más común)
 *   3 = spend-based / estimado
 */
export type DataQualityTier = 1 | 2 | 3
/** GHG Protocol Scope 2 dual reporting (sólo aplica cuando scope='s2'). */
export type Scope2Method = 'location_based' | 'market_based'
/** Tipos de instrumentos contractuales soportados (renewable_instruments). */
export type RenewableInstrumentType = 'GoO' | 'REC' | 'PPA' | 'green_tariff'
/** Tipos de carbon removals/offsets soportados. Alineado con registries comunes. */
export type CarbonRemovalType =
  | 'REC'
  | 'VCS'
  | 'GoldStandard'
  | 'PlanVivo'
  | 'biochar'
  | 'DAC'
  | 'afforestation'
  | 'other'

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
  /** ESRS/CSRD data quality tier (20250425120000_data_quality_tier.sql). */
  data_quality_tier: DataQualityTier
  data_quality_notes: string | null
  /**
   * GHG Protocol Scope 2 dual reporting (20250425130000_scope2_method.sql).
   * Sólo presente cuando scope='s2'; null en s1/s3 (constraint en DB).
   */
  scope2_method: Scope2Method | null
  /**
   * Trazabilidad de conversión (20250425160000_emission_entries_conversion_trace.sql).
   *   quantity = quantity_input * conversion_factor
   *
   * En entradas sin conversión, conversion_factor=1 y los inputs reflejan
   * la unidad nativa del factor.
   */
  quantity_input: number | null
  quantity_input_unit: string | null
  conversion_factor: number
  created_at: string
  updated_at: string
}

/**
 * Justificante adjunto a una `EmissionEntry`.
 *
 * Migración: 20250425140000_evidence_attachments.sql
 * Path Storage: `{organization_id}/{entry_id}/{filename}` (bucket privado `evidence`).
 */
export interface EvidenceAttachment {
  id: string
  entry_id: string
  uploaded_by: string | null
  filename: string
  mime_type: string | null
  file_size_bytes: number | null
  storage_path: string
  description: string | null
  created_at: string
}

/**
 * Removals / offsets / insets. Tabla SEPARADA de emisiones brutas.
 *
 * Migración: 20250425150000_carbon_removals.sql
 * GHG Protocol y ESRS exigen no netear contra emisiones brutas; UI muestra
 * siempre Gross / Removals / Net en líneas separadas.
 */
export interface CarbonRemoval {
  id: string
  organization_id: string
  inventory_year: number
  type: CarbonRemovalType
  volume_tco2e: number
  project_name: string | null
  project_id: string | null
  vintage_year: number | null
  certificate_registry_url: string | null
  cost_eur: number | null
  retirement_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/**
 * Instrumentos contractuales para Scope 2 market-based.
 *
 * Migración: 20250425130100_renewable_instruments.sql
 */
export interface RenewableInstrument {
  id: string
  organization_id: string
  year: number
  type: RenewableInstrumentType
  volume_kwh: number
  vintage_year: number | null
  certificate_id: string | null
  supplier: string | null
  cost_eur: number | null
  retirement_date: string | null
  notes: string | null
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
