/**
 * Conversión de unidades para el cálculo de emisiones.
 *
 * Cuando el usuario carga su consumo en una unidad distinta a la del factor
 * (ej. 50.000 m³ de gas natural pero el factor está en kWh PCS), este módulo
 * resuelve si la conversión es posible y qué factor aplica.
 *
 * Diseño:
 *   - GENERIC_CONVERSIONS: conversiones unit-only que no dependen de la
 *     actividad (t→kg, MWh→kWh, etc.).
 *   - ACTIVITY_CONVERSIONS: conversiones content-specific por `activity_key`
 *     (densidades de combustibles, PCS de gas natural, etc.).
 *
 * Las conversiones se buscan en orden:
 *   1) Override por activity_key (más específico).
 *   2) Generic.
 *   3) Reverso automático con 1/factor.
 *
 * Sin migración de DB en v1.1: la cantidad se normaliza en memoria a la
 * unidad del factor antes de guardar; el rastro de la conversión se anota
 * en `data_quality_notes` para auditoría.
 */

export interface UnitConversion {
  /** Unidad de partida (la que tiene el usuario). */
  fromUnit: string
  /** Unidad destino (la del factor). */
  toUnit: string
  /** Multiplicador: result = quantity_from * factor. */
  factor: number
  /** Fuente / autoridad del valor (auditoría). */
  source?: string
  /** Nota corta legible para el analista. */
  note?: string
}

/**
 * Conversiones unit-agnostic (válidas siempre que las unidades coincidan
 * en familia: masa, energía, volumen, distancia).
 */
const GENERIC_CONVERSIONS: UnitConversion[] = [
  // ── Masa ──────────────────────────────────────────────────────────
  { fromUnit: 't', toUnit: 'kg', factor: 1000, source: 'SI' },
  { fromUnit: 'g', toUnit: 'kg', factor: 1 / 1000, source: 'SI' },
  // ── Energía (kWh ↔ MWh ↔ GWh) ─────────────────────────────────────
  { fromUnit: 'MWh', toUnit: 'kWh', factor: 1000, source: 'SI' },
  { fromUnit: 'GWh', toUnit: 'kWh', factor: 1_000_000, source: 'SI' },
  // El catálogo IDAE usa "kWh PCS" para gas; tratamos MWh PCS análogamente
  { fromUnit: 'MWh PCS', toUnit: 'kWh PCS', factor: 1000, source: 'SI' },
  // ── Volumen ───────────────────────────────────────────────────────
  { fromUnit: 'L', toUnit: 'm3', factor: 1 / 1000, source: 'SI' },
  // ── Distancia ─────────────────────────────────────────────────────
  { fromUnit: 'm', toUnit: 'km', factor: 1 / 1000, source: 'SI' },
]

/**
 * Conversiones específicas por actividad (densidades, poder calorífico).
 *
 * IMPORTANTE: estos valores son representativos. Antes de usar en
 * reporting auditado, verificar contra la edición vigente de la fuente.
 */
const ACTIVITY_CONVERSIONS: Record<string, UnitConversion[]> = {
  // Gas natural España: 1 m³ ≈ 11.7 kWh PCS (poder calorífico superior)
  fuel_natural_gas_es: [
    { fromUnit: 'm3', toUnit: 'kWh PCS', factor: 11.7, source: 'IDAE 2023', note: 'PCS gas natural España' },
    { fromUnit: 'm3', toUnit: 'kWh', factor: 11.7, source: 'IDAE 2023', note: 'PCS gas natural España (asumiendo PCS)' },
  ],

  // Gasóleo automoción: densidad ~0.835 kg/L
  fuel_diesel_auto_es: [
    { fromUnit: 'kg', toUnit: 'L', factor: 1 / 0.835, source: 'Densidad ~0.835 kg/L', note: 'Gasóleo A automoción' },
  ],
  // Gasolina 95: densidad ~0.745 kg/L
  fuel_gasoline_auto_es: [
    { fromUnit: 'kg', toUnit: 'L', factor: 1 / 0.745, source: 'Densidad ~0.745 kg/L', note: 'Gasolina 95' },
  ],
  // Gasóleo C calefacción: densidad ~0.845 kg/L
  fuel_heating_oil_es: [
    { fromUnit: 'kg', toUnit: 'L', factor: 1 / 0.845, source: 'Densidad ~0.845 kg/L', note: 'Gasóleo C calefacción' },
  ],
  // Fuelóleo: densidad ~0.96 kg/L
  fuel_fueloil_es: [
    { fromUnit: 'L', toUnit: 'kg', factor: 0.96, source: 'Densidad ~0.96 kg/L', note: 'Fuelóleo industrial' },
  ],
  // GLP: densidad ~0.51 kg/L (propano comercial)
  fuel_lpg_propane_es: [
    { fromUnit: 'kg', toUnit: 'L', factor: 1 / 0.51, source: 'Densidad ~0.51 kg/L', note: 'GLP / propano' },
  ],
  fuel_lpg_auto_es: [
    { fromUnit: 'kg', toUnit: 'L', factor: 1 / 0.55, source: 'Densidad ~0.55 kg/L', note: 'GLP automoción' },
  ],
}

/** Devuelve la conversión disponible (incluyendo reversos), o null. */
export function findConversion(
  fromUnit: string,
  toUnit: string,
  activityKey?: string
): UnitConversion | null {
  if (fromUnit === toUnit) {
    return { fromUnit, toUnit, factor: 1 }
  }

  // 1. Específica por actividad
  if (activityKey && ACTIVITY_CONVERSIONS[activityKey]) {
    const direct = ACTIVITY_CONVERSIONS[activityKey].find(
      (c) => c.fromUnit === fromUnit && c.toUnit === toUnit
    )
    if (direct) return direct

    const reverse = ACTIVITY_CONVERSIONS[activityKey].find(
      (c) => c.fromUnit === toUnit && c.toUnit === fromUnit
    )
    if (reverse) {
      return {
        fromUnit,
        toUnit,
        factor: 1 / reverse.factor,
        source: reverse.source,
        note: reverse.note,
      }
    }
  }

  // 2. Genérica
  const direct = GENERIC_CONVERSIONS.find(
    (c) => c.fromUnit === fromUnit && c.toUnit === toUnit
  )
  if (direct) return direct

  const reverse = GENERIC_CONVERSIONS.find(
    (c) => c.fromUnit === toUnit && c.toUnit === fromUnit
  )
  if (reverse) {
    return {
      fromUnit,
      toUnit,
      factor: 1 / reverse.factor,
      source: reverse.source,
      note: reverse.note,
    }
  }

  return null
}

/**
 * Lista las unidades de entrada compatibles con la unidad destino del factor.
 * Útil para el dropdown del modal.
 */
export function listCompatibleInputUnits(
  targetUnit: string,
  activityKey?: string
): string[] {
  const set = new Set<string>([targetUnit])

  if (activityKey && ACTIVITY_CONVERSIONS[activityKey]) {
    for (const c of ACTIVITY_CONVERSIONS[activityKey]) {
      if (c.toUnit === targetUnit) set.add(c.fromUnit)
      if (c.fromUnit === targetUnit) set.add(c.toUnit)
    }
  }
  for (const c of GENERIC_CONVERSIONS) {
    if (c.toUnit === targetUnit) set.add(c.fromUnit)
    if (c.fromUnit === targetUnit) set.add(c.toUnit)
  }

  return Array.from(set)
}

/**
 * Convierte una cantidad desde una unidad de entrada a la unidad destino.
 * Devuelve null si no hay conversión disponible.
 */
export function convertQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  activityKey?: string
): { value: number; conversion: UnitConversion } | null {
  const conv = findConversion(fromUnit, toUnit, activityKey)
  if (!conv) return null
  return { value: quantity * conv.factor, conversion: conv }
}
