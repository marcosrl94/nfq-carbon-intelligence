'use client'

import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Search, Check, Paperclip, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AttachmentsDrawer } from './attachments-drawer'
import { convertQuantity, listCompatibleInputUnits } from '@/lib/emissions/unit-conversion'
import { deleteEmissionEntry } from '@/lib/emissions/actions'
import type { DataQualityTier, EmissionEntry, EmissionFactor, EvidenceAttachment, GHGInventory, Scope, Scope2Method } from '@/types/database'

type EntryWithAttachments = EmissionEntry & { evidence_attachments?: EvidenceAttachment[] | null }

const scopeLabels: Record<Scope, string> = {
  s1: 'Alcance 1 — Directas',
  s2: 'Alcance 2 — Electricidad',
  s3: 'Alcance 3 — Cadena de valor',
}

const scopeBadgeVariant: Record<Scope, 'danger' | 'warning' | 'success'> = {
  s1: 'danger',
  s2: 'warning',
  s3: 'success',
}

/** Etiqueta corta para mostrar junto al badge de tier. */
const tierShortLabel: Record<DataQualityTier, string> = {
  1: 'T1 · Primario supplier',
  2: 'T2 · Primario genérico',
  3: 'T3 · Estimado',
}

/** Texto largo que va al tooltip (atributo title) del badge. */
const tierTooltip: Record<DataQualityTier, string> = {
  1: 'Tier 1 — Actividad primaria + factor supplier-specific (la mejor calidad).',
  2: 'Tier 2 — Actividad primaria + factor genérico del catálogo (caso más común).',
  3: 'Tier 3 — Spend-based / estimado (la calidad mínima auditable).',
}

const tierBadgeVariant: Record<DataQualityTier, 'success' | 'info' | 'warning'> = {
  1: 'success',
  2: 'info',
  3: 'warning',
}

const scope2MethodLabel: Record<Scope2Method, string> = {
  location_based: 'Location-based',
  market_based: 'Market-based',
}

const scope2MethodTooltip: Record<Scope2Method, string> = {
  location_based: 'Factor del mix de la red eléctrica (MITECO/DEFRA grid). Refleja la intensidad media del territorio.',
  market_based: 'Factor contractual (GoOs / RECs / PPAs / green tariff) o residual mix si no hay instrumento. GHG Protocol Scope 2 Guidance exige reportar AMBOS métodos.',
}

/** tCO2e = quantity * ef_value / 1000 (ef_value en kgCO2e / 1 ef_unit). */
function computeTco2e(quantity: number | null, efValue: number | null): number | null {
  if (quantity == null || efValue == null) return null
  if (Number.isNaN(quantity) || Number.isNaN(efValue)) return null
  return (quantity * efValue) / 1000
}

/** Formato de número consistente (es-ES, hasta 3 decimales). */
function fmt(n: number | null, opts?: Intl.NumberFormatOptions): string {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString('es-ES', { maximumFractionDigits: 3, ...opts })
}

interface Props {
  inventory: GHGInventory
  entries: EntryWithAttachments[]
  /**
   * Catálogo de factores (MITECO/IDAE/DEFRA).
   * Pasado desde el server component; lo usa el picker de nueva entrada
   * para reemplazar el input manual de ef_value por "pick actividad + cantidad".
   */
  factors: EmissionFactor[]
}

export function InventoryDetail({ inventory, entries, factors }: Props) {
  const [attachmentsForEntryId, setAttachmentsForEntryId] = useState<string | null>(null)
  const attachmentsEntry = useMemo(
    () => entries.find((e) => e.id === attachmentsForEntryId) ?? null,
    [entries, attachmentsForEntryId]
  )
  const [adding, setAdding] = useState(false)
  const [scope, setScope] = useState<Scope>('s1')
  const [search, setSearch] = useState('')
  const [selectedFactorId, setSelectedFactorId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState('')
  // Default = 2 porque hoy el único path es el picker del catálogo (factor genérico
  // sobre actividad primaria). El analista puede subir a 1 si tiene un EF
  // supplier-specific o bajar a 3 si en realidad es spend-based.
  const [dataQualityTier, setDataQualityTier] = useState<DataQualityTier>(2)
  const [dataQualityNotes, setDataQualityNotes] = useState('')
  // Sólo se persiste cuando scope=s2 (constraint DB).
  const [scope2Method, setScope2Method] = useState<Scope2Method>('location_based')
  // Unidad en la que el usuario introduce la cantidad (puede diferir del
  // ef_unit del factor si hay conversión disponible).
  const [inputUnit, setInputUnit] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const selectedFactor = useMemo(
    () => factors.find((f) => f.id === selectedFactorId) ?? null,
    [factors, selectedFactorId]
  )

  // ── Equivalencia scope2_method ↔ factor *_market_residual ──────────────
  // Convención: el factor "market-based residual" del catálogo tiene la
  // misma activity_key + suffix '_market_residual'. Si el analista marca
  // market_based con un factor location, intentamos el swap automático.
  // Recíproco al volver a location_based.
  const isResidualFactor =
    selectedFactor?.activity_key.endsWith('_market_residual') ?? false

  const marketResidualPair = useMemo(() => {
    if (!selectedFactor || selectedFactor.scope !== 's2') return null
    const targetKey = isResidualFactor
      ? null // ya estamos en residual
      : `${selectedFactor.activity_key}_market_residual`
    if (!targetKey) return null
    return factors.find((f) => f.activity_key === targetKey) ?? null
  }, [factors, selectedFactor, isResidualFactor])

  const locationPair = useMemo(() => {
    if (!selectedFactor || !isResidualFactor) return null
    const targetKey = selectedFactor.activity_key.replace(/_market_residual$/, '')
    return factors.find((f) => f.activity_key === targetKey) ?? null
  }, [factors, selectedFactor, isResidualFactor])

  // Sincroniza scope2Method ↔ factor activo. Una sola dirección por render
  // gracias a las guardas (la condición que dispara el setSelectedFactorId
  // deja de cumplirse en el siguiente render porque cambian los pares).
  useEffect(() => {
    if (!selectedFactor || selectedFactor.scope !== 's2') return
    if (scope2Method === 'market_based' && !isResidualFactor && marketResidualPair) {
      setSelectedFactorId(marketResidualPair.id)
    } else if (scope2Method === 'location_based' && isResidualFactor && locationPair) {
      setSelectedFactorId(locationPair.id)
    }
  }, [scope2Method, isResidualFactor, marketResidualPair, locationPair, selectedFactor])

  // Reset de la unidad de entrada cuando cambia el factor.
  useEffect(() => {
    setInputUnit(selectedFactor?.ef_unit ?? null)
  }, [selectedFactor?.id, selectedFactor?.ef_unit])

  const compatibleUnits = useMemo(() => {
    if (!selectedFactor) return [] as string[]
    return listCompatibleInputUnits(selectedFactor.ef_unit, selectedFactor.activity_key)
  }, [selectedFactor])

  const effectiveInputUnit = inputUnit ?? selectedFactor?.ef_unit ?? ''

  const filteredFactors = useMemo(() => {
    const q = search.trim().toLowerCase()
    return factors.filter((f) => {
      if (f.scope !== scope) return false
      // Los factores market_residual se acceden vía auto-swap del método Scope 2,
      // no directamente desde el picker (evita confusión y elecciones inconsistentes).
      if (f.scope === 's2' && f.activity_key.endsWith('_market_residual')) return false
      if (!q) return true
      const hay = [f.activity_label, f.category, f.subcategory, f.source, f.region]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [factors, scope, search])

  /** Agrupa factores filtrados por categoría para el listado. */
  const groupedFactors = useMemo(() => {
    const map = new Map<string, EmissionFactor[]>()
    for (const f of filteredFactors) {
      const key = f.category
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(f)
    }
    return Array.from(map.entries())
  }, [filteredFactors])

  const q = quantity ? Number(quantity) : null

  /**
   * Si la unidad de entrada difiere de ef_unit, aplica la conversión.
   * Devuelve null cuando no hay diferencia o no hay valor numérico.
   */
  const conversion = useMemo(() => {
    if (!selectedFactor || q == null || Number.isNaN(q)) return null
    if (effectiveInputUnit === selectedFactor.ef_unit) return null
    return convertQuantity(q, effectiveInputUnit, selectedFactor.ef_unit, selectedFactor.activity_key)
  }, [selectedFactor, q, effectiveInputUnit])

  /** Cantidad normalizada a la unidad del factor (ya sea convertida o nativa). */
  const normalizedQuantity = conversion ? conversion.value : q
  const liveTco2e = selectedFactor ? computeTco2e(normalizedQuantity, selectedFactor.ef_value) : null

  function resetForm() {
    setAdding(false)
    setScope('s1')
    setSearch('')
    setSelectedFactorId(null)
    setQuantity('')
    setDataQualityTier(2)
    setDataQualityNotes('')
    setScope2Method('location_based')
    setInputUnit(null)
  }

  async function handleAdd() {
    if (!selectedFactor || q == null || Number.isNaN(q)) return
    if (conversion === null && effectiveInputUnit !== selectedFactor.ef_unit) {
      // El usuario eligió una unidad incompatible para la que no tenemos conversión.
      // En la UI esto no debería ocurrir (el dropdown sólo lista compatibles), pero
      // protegemos por si acaso.
      console.warn('[emissions] unidad incompatible sin conversión disponible')
      return
    }
    setLoading(true)

    // Cantidad final en la unidad del factor (normalizada).
    const finalQuantity = normalizedQuantity ?? q
    const tco2e = computeTco2e(finalQuantity, selectedFactor.ef_value)

    // Trazabilidad: ahora vive en columnas estructuradas. Las notas quedan
    // libres para el analista; la traza de conversión se reconstruye desde
    // (quantity_input, quantity_input_unit, conversion_factor).
    const conversionFactor = conversion ? conversion.conversion.factor : 1

    // Snapshot del factor en la entrada: si el catálogo cambia luego, esta fila
    // conserva el valor usado. factor_id referencia la fila viva del catálogo.
    const payload = {
      inventory_id: inventory.id,
      scope: selectedFactor.scope,
      category: selectedFactor.category,
      subcategory: selectedFactor.subcategory ?? null,
      quantity: finalQuantity,
      unit: selectedFactor.ef_unit,
      // Trazabilidad de conversión (20250425160000)
      quantity_input: q,
      quantity_input_unit: effectiveInputUnit,
      conversion_factor: conversionFactor,
      ef_value: selectedFactor.ef_value,
      ef_source: selectedFactor.source_version ?? selectedFactor.source,
      tco2e,
      factor_id: selectedFactor.id,
      data_quality_tier: dataQualityTier,
      data_quality_notes: dataQualityNotes.trim() || null,
      // Constraint DB: scope='s2' ⇔ scope2_method not null.
      scope2_method: selectedFactor.scope === 's2' ? scope2Method : null,
    }
    const { error } = await supabase.from('emission_entries').insert(payload)
    if (error) {
      console.error('[emission_entries.insert]', error)
    }
    resetForm()
    setLoading(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    // Server action: borra blobs en Storage primero, luego la entry. La FK
    // cascade limpia las filas de evidence_attachments. Sin esto los archivos
    // físicos quedaban huérfanos en el bucket.
    const result = await deleteEmissionEntry(id)
    if (!result.ok) {
      console.error('[deleteEmissionEntry]', result.error)
      // Mostramos un alert sencillo; aún no tenemos un toaster global.
      alert(`No se pudo borrar: ${result.error}`)
      return
    }
    router.refresh()
  }

  async function handleStatusChange(status: string) {
    const updates: Record<string, unknown> = { status }
    if (status === 'submitted') updates.submitted_at = new Date().toISOString()
    if (status === 'verified') updates.verified_at = new Date().toISOString()
    await supabase.from('ghg_inventories').update(updates).eq('id', inventory.id)
    router.refresh()
  }

  /**
   * Export CSV con trazabilidad completa del inventario actual.
   * JOIN con emission_factors para recuperar activity_key/year/region (no
   * están denormalizados en la entry).
   */
  async function handleExportCsv() {
    const { data, error } = await supabase
      .from('emission_entries')
      .select('*, emission_factors(activity_key, year, region, source_version)')
      .eq('inventory_id', inventory.id)
      .order('scope', { ascending: true })
      .order('category', { ascending: true })
    if (error) {
      console.error('[emission_entries.export]', error)
      return
    }
    type Row = EmissionEntry & {
      emission_factors?: { activity_key: string | null; year: number | null; region: string | null; source_version: string | null } | null
    }
    const rows = (data ?? []) as Row[]
    const csv = Papa.unparse({
      fields: [
        'inventory_year', 'scope', 'category', 'subcategory',
        'activity_key', 'factor_year', 'factor_region',
        'quantity_input', 'quantity_input_unit', 'conversion_factor',
        'quantity', 'unit',
        'ef_value', 'ef_unit', 'ef_source', 'source_version',
        'tco2e',
        'data_quality_tier', 'data_quality_notes',
        'scope2_method',
        'created_at',
      ],
      data: rows.map((r) => [
        inventory.fiscal_year,
        r.scope,
        r.category ?? '',
        r.subcategory ?? '',
        r.emission_factors?.activity_key ?? '',
        r.emission_factors?.year ?? '',
        r.emission_factors?.region ?? '',
        r.quantity_input ?? '',
        r.quantity_input_unit ?? '',
        r.conversion_factor ?? 1,
        r.quantity ?? '',
        r.unit ?? '',
        r.ef_value ?? '',
        r.unit ?? '',
        r.ef_source ?? '',
        r.emission_factors?.source_version ?? '',
        r.tco2e ?? '',
        r.data_quality_tier,
        r.data_quality_notes ?? '',
        r.scope2_method ?? '',
        r.created_at,
      ]),
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventario-${inventory.fiscal_year}-${inventory.id.slice(0, 8)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const grouped = (['s1', 's2', 's3'] as Scope[]).map(s => ({
    scope: s,
    entries: entries.filter(e => e.scope === s),
    total: entries.filter(e => e.scope === s).reduce((sum, e) => sum + (e.tco2e ?? 0), 0),
  }))

  return (
    <div className="p-6 space-y-6">
      {/* Scope breakdown */}
      <div className="space-y-4">
        {grouped.map(({ scope: s, entries: scopeEntries, total }) => (
          <div key={s}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant={scopeBadgeVariant[s]}>{s.toUpperCase()}</Badge>
                <span className="text-sm text-zinc-300">{scopeLabels[s]}</span>
              </div>
              <span className="text-sm font-medium text-zinc-300">
                {total > 0 ? `${total.toLocaleString('es-ES')} tCO₂e` : '—'}
              </span>
            </div>
            {scopeEntries.length > 0 && (
              <div className="rounded-lg border border-zinc-800/50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">Categoría</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500">Cantidad</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500">Unidad</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500">FE</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-zinc-500">Calidad</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500">tCO₂e</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-zinc-500 w-12">
                        <Paperclip className="h-3.5 w-3.5 inline-block" />
                      </th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {scopeEntries.map((entry) => {
                      const tier = (entry.data_quality_tier ?? 3) as DataQualityTier
                      const tierTitle = entry.data_quality_notes
                        ? `${tierTooltip[tier]}\n\n${entry.data_quality_notes}`
                        : tierTooltip[tier]
                      return (
                        <tr key={entry.id} className="hover:bg-zinc-800/20">
                          <td className="px-4 py-2 text-zinc-300">{entry.category ?? '—'}</td>
                          <td className="px-4 py-2 text-right text-zinc-400">{entry.quantity?.toLocaleString('es-ES') ?? '—'}</td>
                          <td className="px-4 py-2 text-right text-zinc-500">{entry.unit ?? '—'}</td>
                          <td className="px-4 py-2 text-right text-zinc-500">{entry.ef_value ?? '—'}</td>
                          <td className="px-4 py-2 text-center">
                            <span title={tierTitle} className="cursor-help">
                              <Badge variant={tierBadgeVariant[tier]}>T{tier}</Badge>
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-zinc-200">{entry.tco2e?.toLocaleString('es-ES') ?? '—'}</td>
                          <td className="px-4 py-2 text-center">
                            {(() => {
                              const count = entry.evidence_attachments?.length ?? 0
                              return (
                                <button
                                  onClick={() => setAttachmentsForEntryId(entry.id)}
                                  title={count > 0 ? `${count} justificante${count === 1 ? '' : 's'}` : 'Adjuntar justificante'}
                                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors ${
                                    count > 0
                                      ? 'text-emerald-400 hover:bg-emerald-500/10'
                                      : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/40'
                                  }`}
                                >
                                  <Paperclip className="h-3.5 w-3.5" />
                                  {count > 0 && <span className="tabular-nums">{count}</span>}
                                </button>
                              )
                            })()}
                          </td>
                          <td className="px-4 py-2">
                            <button onClick={() => handleDelete(entry.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Añadir entrada
        </button>
        <button
          onClick={handleExportCsv}
          disabled={entries.length === 0}
          className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Descargar CSV con trazabilidad completa (activity_key, factor year/region, snapshot, tier, scope2_method)"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </button>
        {inventory.status === 'draft' && (
          <button
            onClick={() => handleStatusChange('submitted')}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
          >
            Enviar a revisión
          </button>
        )}
        {inventory.status === 'submitted' && (
          <button
            onClick={() => handleStatusChange('verified')}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            Marcar como verificado
          </button>
        )}
      </div>

      {/* Attachments drawer */}
      {attachmentsEntry && (
        <AttachmentsDrawer
          entry={attachmentsEntry}
          attachments={attachmentsEntry.evidence_attachments ?? []}
          organizationId={inventory.organization_id}
          onClose={() => setAttachmentsForEntryId(null)}
        />
      )}

      {/* Add entry modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900 p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Nueva entrada de emisión</h3>
              <span className="text-[11px] text-zinc-500">
                Catálogo: {factors.length} factores MITECO/IDAE/DEFRA
              </span>
            </div>

            {/* Scope selector — filtra el picker */}
            <div className="flex items-center gap-2">
              {(['s1', 's2', 's3'] as Scope[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setScope(s)
                    setSelectedFactorId(null)
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    scope === s
                      ? 'bg-emerald-600 text-white'
                      : 'border border-zinc-700 bg-zinc-800/30 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  {scopeLabels[s]}
                </button>
              ))}
            </div>

            {/* Scope 2 dual reporting (GHG Protocol Scope 2 Guidance) */}
            {scope === 's2' && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-blue-300">Método Scope 2</label>
                  <span className="text-[10px] text-zinc-500">GHG Protocol Scope 2 Guidance</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['location_based', 'market_based'] as Scope2Method[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setScope2Method(m)}
                      title={scope2MethodTooltip[m]}
                      className={`rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                        scope2Method === m
                          ? 'bg-blue-600 text-white'
                          : 'border border-zinc-700 bg-zinc-800/30 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      {scope2MethodLabel[m]}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-400 leading-snug">
                  {scope2MethodTooltip[scope2Method]}
                </p>
                {scope2Method === 'market_based' && (
                  <p className="text-[10px] text-amber-300/90 leading-snug">
                    Recuerda declarar tus instrumentos contractuales en{' '}
                    <span className="underline">Configuración → Energía renovable</span>.
                  </p>
                )}
                {/* Estado del swap automático factor location ↔ residual */}
                {selectedFactor && scope2Method === 'market_based' && (
                  isResidualFactor ? (
                    <p className="text-[10px] text-emerald-300/90 leading-snug">
                      ✓ Factor activo: <span className="font-mono">{selectedFactor.activity_key}</span>{' '}
                      (residual mix). Si tu consumo está cubierto por GoOs/RECs/PPAs retirados,
                      ese instrumento prevalece sobre el residual.
                    </p>
                  ) : !marketResidualPair ? (
                    <p className="text-[10px] text-amber-400 leading-snug">
                      ⚠ No hay factor <span className="font-mono">{selectedFactor.activity_key}_market_residual</span>{' '}
                      en el catálogo. El cálculo usa el factor location-based como aproximación —
                      anota la limitación en notas y prioriza añadir el residual al catálogo antes
                      del reporting auditado.
                    </p>
                  ) : null
                )}
                {selectedFactor && scope2Method === 'location_based' && isResidualFactor && !locationPair && (
                  <p className="text-[10px] text-amber-400 leading-snug">
                    ⚠ Factor residual activo pero el método es location-based. Sin equivalente
                    location en el catálogo no podemos hacer el swap automático.
                  </p>
                )}
              </div>
            )}

            {/* Buscador */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar actividad (ej: gas natural, electricidad, coche diésel…)"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Lista agrupada por categoría */}
            <div className="flex-1 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/50 min-h-[180px]">
              {groupedFactors.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500">
                  Ninguna actividad coincide. Prueba otro alcance o cambia la búsqueda.
                </div>
              ) : (
                groupedFactors.map(([cat, items]) => (
                  <div key={cat} className="border-b border-zinc-800 last:border-b-0">
                    <div className="sticky top-0 bg-zinc-900/90 backdrop-blur px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
                      {cat}
                    </div>
                    {items.map((f) => {
                      const isSelected = f.id === selectedFactorId
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setSelectedFactorId(f.id)}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors ${
                            isSelected
                              ? 'bg-emerald-500/10 text-white'
                              : 'text-zinc-300 hover:bg-zinc-800/40'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{f.activity_label}</div>
                            <div className="truncate text-[10px] text-zinc-500">
                              {f.subcategory ? `${f.subcategory} · ` : ''}
                              {f.source} {f.year} · {f.region}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-mono text-[11px] text-zinc-300">
                              {fmt(f.ef_value, { maximumFractionDigits: 5 })}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              kgCO₂e/{f.ef_unit}
                            </div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 shrink-0 text-emerald-400" />}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Cantidad + unidad + preview de cálculo */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 space-y-3">
              <div className="grid grid-cols-[1fr,auto,auto] gap-3 items-end">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    Cantidad
                    {selectedFactor && (
                      <span className="text-zinc-500"> (en {effectiveInputUnit})</span>
                    )}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    disabled={!selectedFactor}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none disabled:opacity-40"
                    placeholder={selectedFactor ? '0' : 'Selecciona una actividad primero'}
                  />
                </div>
                {selectedFactor && compatibleUnits.length > 1 && (
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Unidad</label>
                    <select
                      value={effectiveInputUnit}
                      onChange={(e) => setInputUnit(e.target.value)}
                      className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-2.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      title="Si tu lectura está en otra unidad compatible, cámbiala aquí; convertimos automáticamente."
                    >
                      {compatibleUnits.map((u) => (
                        <option key={u} value={u}>
                          {u}
                          {u === selectedFactor.ef_unit ? ' (factor)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="text-right">
                  <div className="text-[11px] text-zinc-400 mb-1">tCO₂e (calculado)</div>
                  <div className="font-mono text-lg font-semibold text-emerald-400 tabular-nums">
                    {fmt(liveTco2e)}
                  </div>
                </div>
              </div>
              {selectedFactor && q != null && !Number.isNaN(q) && (
                <div className="space-y-1">
                  {conversion && normalizedQuantity != null && (
                    <div className="text-[11px] text-blue-300 font-mono leading-relaxed">
                      Conversión: {fmt(q)} {effectiveInputUnit}
                      {' × '}{conversion.conversion.factor}
                      {' = '}{fmt(normalizedQuantity)} {selectedFactor.ef_unit}
                      {conversion.conversion.source && (
                        <span className="text-zinc-500"> · {conversion.conversion.source}</span>
                      )}
                    </div>
                  )}
                  <div className="text-[11px] text-zinc-500 font-mono leading-relaxed">
                    {fmt(normalizedQuantity)} {selectedFactor.ef_unit}
                    {' × '}
                    {fmt(selectedFactor.ef_value, { maximumFractionDigits: 5 })} kgCO₂e/{selectedFactor.ef_unit}
                    {' ÷ 1000 = '}
                    <span className="text-emerald-400">{fmt(liveTco2e)} tCO₂e</span>
                    {' · '}
                    <span className="text-zinc-400">
                      Fuente: {selectedFactor.source_version ?? selectedFactor.source}
                      {' · '}{selectedFactor.region}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Calidad del dato (ESRS/CSRD) */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 space-y-3">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1.5">Calidad del dato</label>
                <div className="grid grid-cols-3 gap-2">
                  {([1, 2, 3] as DataQualityTier[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDataQualityTier(t)}
                      title={tierTooltip[t]}
                      className={`rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                        dataQualityTier === t
                          ? 'bg-emerald-600 text-white'
                          : 'border border-zinc-700 bg-zinc-800/30 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      {tierShortLabel[t]}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-zinc-500 leading-snug">
                  {tierTooltip[dataQualityTier]}
                </p>
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Notas del analista <span className="text-zinc-500">(opcional)</span>
                </label>
                <textarea
                  value={dataQualityNotes}
                  onChange={(e) => setDataQualityNotes(e.target.value)}
                  rows={2}
                  placeholder="Origen del dato, supuestos, fuente de la factura…"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg px-3.5 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={loading || !selectedFactor || q == null || Number.isNaN(q)}
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Guardando…' : 'Guardar entrada'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
