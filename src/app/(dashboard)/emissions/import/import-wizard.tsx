'use client'

import { useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Download, Upload, Check, AlertCircle, FileText, Loader2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { DataQualityTier, EmissionFactor, GHGInventory, Scope } from '@/types/database'

interface Props {
  inventories: GHGInventory[]
  factors: EmissionFactor[]
}

interface RawRow {
  inventory_year?: string
  scope?: string
  activity_key?: string
  quantity?: string
  data_quality_tier?: string
  notes?: string
}

interface ParsedRow {
  rowIdx: number
  raw: RawRow
  errors: string[]
  // resolved
  inventoryId?: string
  factor?: EmissionFactor
  scope?: Scope
  quantity?: number
  tier?: DataQualityTier
  notes?: string | null
  tco2e?: number | null
}

const TEMPLATE_HEADERS = [
  'inventory_year',
  'scope',
  'activity_key',
  'quantity',
  'data_quality_tier',
  'notes',
] as const

const TEMPLATE_SAMPLE = [
  ['2024', 's1', 'fuel_natural_gas_es', '12500', '2', 'Caldera nave 1'],
  ['2024', 's2', 'electricity_grid_es_2023', '85000', '2', 'Sede central'],
  ['2024', 's3', 'travel_flight_long_eco', '4500', '3', 'Reuniones cliente'],
]

/** Calcula tCO2e con la misma fórmula que el modal: quantity * ef_value / 1000. */
function computeTco2e(quantity: number, efValue: number): number {
  return (quantity * efValue) / 1000
}

function parseTier(s: string | undefined, errors: string[]): DataQualityTier | undefined {
  if (!s || !s.trim()) return 3
  const n = Number(s.trim())
  if (n === 1 || n === 2 || n === 3) return n
  errors.push(`data_quality_tier inválido: "${s}" (debe ser 1, 2 o 3)`)
  return undefined
}

function parseScope(s: string | undefined, errors: string[]): Scope | undefined {
  const v = s?.trim().toLowerCase()
  if (v === 's1' || v === 's2' || v === 's3') return v
  errors.push(`scope inválido: "${s}" (debe ser s1, s2 o s3)`)
  return undefined
}

function downloadTemplate() {
  const csv = Papa.unparse({
    fields: [...TEMPLATE_HEADERS],
    data: TEMPLATE_SAMPLE,
  })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla-emisiones.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function ImportWizard({ inventories, factors }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // Mapas auxiliares para validación O(1)
  const inventoryByYear = useMemo(() => {
    const m = new Map<number, GHGInventory>()
    for (const inv of inventories) m.set(inv.fiscal_year, inv)
    return m
  }, [inventories])

  const factorByKey = useMemo(() => {
    const m = new Map<string, EmissionFactor>()
    for (const f of factors) m.set(f.activity_key, f)
    return m
  }, [factors])

  function handleFile(file: File) {
    setImportedCount(null)
    setImportError(null)
    setFilename(file.name)
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const rows = res.data.map((raw, idx) => validateRow(raw, idx))
        setParsed(rows)
      },
      error: (err) => {
        setImportError(`No se pudo parsear: ${err.message}`)
        setParsed([])
      },
    })
  }

  function validateRow(raw: RawRow, rowIdx: number): ParsedRow {
    const errors: string[] = []

    const yearN = Number(raw.inventory_year)
    let inventoryId: string | undefined
    if (!raw.inventory_year || !Number.isInteger(yearN)) {
      errors.push('inventory_year vacío o no entero')
    } else {
      const inv = inventoryByYear.get(yearN)
      if (!inv) errors.push(`No existe inventario para inventory_year=${yearN}`)
      else inventoryId = inv.id
    }

    const scope = parseScope(raw.scope, errors)

    const factor = raw.activity_key ? factorByKey.get(raw.activity_key.trim()) : undefined
    if (!raw.activity_key) {
      errors.push('activity_key vacío')
    } else if (!factor) {
      errors.push(`activity_key "${raw.activity_key}" no existe en el catálogo`)
    } else if (scope && factor.scope !== scope) {
      errors.push(`scope=${scope} no coincide con catálogo (factor es ${factor.scope})`)
    }

    const quantityN = Number(raw.quantity)
    if (!raw.quantity || !Number.isFinite(quantityN) || quantityN <= 0) {
      errors.push(`quantity inválida: "${raw.quantity ?? ''}"`)
    }

    const tier = parseTier(raw.data_quality_tier, errors)

    const notes = raw.notes?.trim() || null
    const tco2e =
      factor && Number.isFinite(quantityN) && quantityN > 0
        ? computeTco2e(quantityN, Number(factor.ef_value))
        : null

    return {
      rowIdx,
      raw,
      errors,
      inventoryId,
      factor,
      scope,
      quantity: Number.isFinite(quantityN) ? quantityN : undefined,
      tier,
      notes,
      tco2e,
    }
  }

  const valid = parsed?.filter((p) => p.errors.length === 0) ?? []
  const invalid = parsed?.filter((p) => p.errors.length > 0) ?? []

  async function handleImport() {
    if (valid.length === 0) return
    setImporting(true)
    setImportError(null)

    const payloads = valid.map((p) => ({
      inventory_id: p.inventoryId!,
      scope: p.scope!,
      category: p.factor!.category,
      subcategory: p.factor!.subcategory ?? null,
      quantity: p.quantity!,
      unit: p.factor!.ef_unit,
      // Sin conversión en bulk import — el CSV expecta cantidad ya en ef_unit.
      quantity_input: p.quantity!,
      quantity_input_unit: p.factor!.ef_unit,
      conversion_factor: 1,
      ef_value: p.factor!.ef_value,
      ef_source: p.factor!.source_version ?? p.factor!.source,
      tco2e: p.tco2e!,
      factor_id: p.factor!.id,
      data_quality_tier: p.tier!,
      data_quality_notes: p.notes,
      // s2 → location_based por defecto en imports (constraint DB exige no-null)
      scope2_method: p.scope === 's2' ? 'location_based' : null,
    }))

    const { error } = await supabase.from('emission_entries').insert(payloads)
    if (error) {
      setImportError(`Insert falló: ${error.message}`)
      setImporting(false)
      return
    }
    setImportedCount(payloads.length)
    setParsed(null)
    setFilename(null)
    setImporting(false)
    router.refresh()
  }

  function reset() {
    setParsed(null)
    setFilename(null)
    setImportError(null)
    setImportedCount(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Drag handlers ──
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(true)
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Plantilla */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/50">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white">1. Descargar plantilla</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Columnas: <code className="text-zinc-400">{TEMPLATE_HEADERS.join(', ')}</code>.
            <span className="text-zinc-500"> data_quality_tier vacío → 3 (estimado).</span>
          </p>
        </div>
        <div className="p-6 flex items-center gap-4 flex-wrap">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            <Download className="h-4 w-4" />
            Descargar plantilla CSV
          </button>
          <p className="text-[11px] text-zinc-500">
            Inventarios disponibles para importar:{' '}
            {inventories.length === 0 ? (
              <span className="text-amber-400">ninguno (crea uno antes)</span>
            ) : (
              inventories.map((i) => i.fiscal_year).join(', ')
            )}
          </p>
        </div>
      </section>

      {/* Step 2: Drop zone */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/50">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white">2. Subir CSV</h2>
        </div>
        <div className="p-6">
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
              dragActive
                ? 'border-emerald-500 bg-emerald-500/5'
                : 'border-zinc-700 bg-zinc-900/40'
            }`}
          >
            <Upload className="h-8 w-8 text-zinc-500 mx-auto mb-3" />
            <p className="text-sm text-zinc-300 mb-1">
              {filename ? (
                <span className="font-mono">{filename}</span>
              ) : (
                'Arrastra el CSV aquí'
              )}
            </p>
            <p className="text-xs text-zinc-500 mb-3">o</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-zinc-700 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Elegir archivo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </div>
        </div>
      </section>

      {/* Step 3: Preview */}
      {parsed !== null && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-950/50">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">3. Vista previa</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {parsed.length} filas leídas ·{' '}
                <span className="text-emerald-400">{valid.length} válidas</span> ·{' '}
                <span className="text-red-400">{invalid.length} con errores</span>
              </p>
            </div>
            <button
              onClick={reset}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              title="Limpiar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {importError && (
            <div className="mx-6 mt-4 rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              {importError}
            </div>
          )}

          {/* Tabla */}
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur">
                <tr className="border-b border-zinc-800">
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-zinc-500 w-10">#</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-zinc-500">Año</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-zinc-500">Scope</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-zinc-500">Actividad</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-zinc-500">Cantidad</th>
                  <th className="px-3 py-2 text-center text-[10px] font-medium text-zinc-500">T</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-zinc-500">tCO₂e</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-zinc-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {parsed.map((row) => (
                  <tr key={row.rowIdx} className={row.errors.length > 0 ? 'bg-red-950/10' : ''}>
                    <td className="px-3 py-2 text-zinc-500">{row.rowIdx + 1}</td>
                    <td className="px-3 py-2 text-zinc-300">{row.raw.inventory_year ?? '—'}</td>
                    <td className="px-3 py-2 text-zinc-400 uppercase">{row.raw.scope ?? '—'}</td>
                    <td className="px-3 py-2 text-zinc-300">
                      <span className="font-mono text-[11px]">{row.raw.activity_key}</span>
                      {row.factor && (
                        <span className="block text-[10px] text-zinc-500">{row.factor.activity_label}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-300 tabular-nums">
                      {row.raw.quantity ?? '—'}{row.factor ? ` ${row.factor.ef_unit}` : ''}
                    </td>
                    <td className="px-3 py-2 text-center text-zinc-400">{row.tier ?? row.raw.data_quality_tier ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-emerald-400 tabular-nums font-medium">
                      {row.tco2e != null ? row.tco2e.toLocaleString('es-ES', { maximumFractionDigits: 3 }) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {row.errors.length === 0 ? (
                        <Badge variant="success">
                          <Check className="h-3 w-3 mr-0.5 inline" />
                          OK
                        </Badge>
                      ) : (
                        <span className="inline-flex items-start gap-1 text-[11px] text-red-300" title={row.errors.join('\n')}>
                          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="leading-snug">{row.errors[0]}{row.errors.length > 1 ? ` (+${row.errors.length - 1})` : ''}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Acciones */}
          <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-end gap-3">
            <button
              onClick={reset}
              className="rounded-lg px-3.5 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={importing || valid.length === 0}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {importing ? 'Importando…' : `Importar ${valid.length} fila${valid.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </section>
      )}

      {/* Confirmación */}
      {importedCount != null && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-600/20 p-2">
            <Check className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-sm text-zinc-200">
            <strong>{importedCount}</strong> entradas importadas correctamente.{' '}
            <a href="/emissions" className="underline text-emerald-300 hover:text-emerald-200">Ver inventario</a>.
          </div>
        </div>
      )}
    </div>
  )
}
