'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Search, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { EmissionEntry, EmissionFactor, GHGInventory, Scope } from '@/types/database'

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
  entries: EmissionEntry[]
  /**
   * Catálogo de factores (MITECO/IDAE/DEFRA).
   * Pasado desde el server component; lo usa el picker de nueva entrada
   * para reemplazar el input manual de ef_value por "pick actividad + cantidad".
   * Próximo paso: refactor del formulario (todavía usa ef_value a mano).
   */
  factors: EmissionFactor[]
}

export function InventoryDetail({ inventory, entries, factors }: Props) {
  const [adding, setAdding] = useState(false)
  const [scope, setScope] = useState<Scope>('s1')
  const [search, setSearch] = useState('')
  const [selectedFactorId, setSelectedFactorId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const selectedFactor = useMemo(
    () => factors.find((f) => f.id === selectedFactorId) ?? null,
    [factors, selectedFactorId]
  )

  const filteredFactors = useMemo(() => {
    const q = search.trim().toLowerCase()
    return factors.filter((f) => {
      if (f.scope !== scope) return false
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
  const liveTco2e = selectedFactor ? computeTco2e(q, selectedFactor.ef_value) : null

  function resetForm() {
    setAdding(false)
    setScope('s1')
    setSearch('')
    setSelectedFactorId(null)
    setQuantity('')
  }

  async function handleAdd() {
    if (!selectedFactor || q == null || Number.isNaN(q)) return
    setLoading(true)
    const tco2e = computeTco2e(q, selectedFactor.ef_value)
    // Snapshot del factor en la entrada: si el catálogo cambia luego, esta fila
    // conserva el valor usado. factor_id referencia la fila viva del catálogo.
    const payload = {
      inventory_id: inventory.id,
      scope: selectedFactor.scope,
      category: selectedFactor.category,
      subcategory: selectedFactor.subcategory ?? null,
      quantity: q,
      unit: selectedFactor.ef_unit,
      ef_value: selectedFactor.ef_value,
      ef_source: selectedFactor.source_version ?? selectedFactor.source,
      tco2e,
      factor_id: selectedFactor.id,
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
    await supabase.from('emission_entries').delete().eq('id', id)
    router.refresh()
  }

  async function handleStatusChange(status: string) {
    const updates: Record<string, unknown> = { status }
    if (status === 'submitted') updates.submitted_at = new Date().toISOString()
    if (status === 'verified') updates.verified_at = new Date().toISOString()
    await supabase.from('ghg_inventories').update(updates).eq('id', inventory.id)
    router.refresh()
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
                      <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500">tCO₂e</th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {scopeEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-zinc-800/20">
                        <td className="px-4 py-2 text-zinc-300">{entry.category ?? '—'}</td>
                        <td className="px-4 py-2 text-right text-zinc-400">{entry.quantity?.toLocaleString('es-ES') ?? '—'}</td>
                        <td className="px-4 py-2 text-right text-zinc-500">{entry.unit ?? '—'}</td>
                        <td className="px-4 py-2 text-right text-zinc-500">{entry.ef_value ?? '—'}</td>
                        <td className="px-4 py-2 text-right font-medium text-zinc-200">{entry.tco2e?.toLocaleString('es-ES') ?? '—'}</td>
                        <td className="px-4 py-2">
                          <button onClick={() => handleDelete(entry.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
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

            {/* Cantidad + preview de cálculo */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 space-y-3">
              <div className="grid grid-cols-[1fr,auto] gap-3 items-end">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    Cantidad
                    {selectedFactor && (
                      <span className="text-zinc-500"> (en {selectedFactor.ef_unit})</span>
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
                <div className="text-right">
                  <div className="text-[11px] text-zinc-400 mb-1">tCO₂e (calculado)</div>
                  <div className="font-mono text-lg font-semibold text-emerald-400 tabular-nums">
                    {fmt(liveTco2e)}
                  </div>
                </div>
              </div>
              {selectedFactor && q != null && !Number.isNaN(q) && (
                <div className="text-[11px] text-zinc-500 font-mono leading-relaxed">
                  {fmt(q)} {selectedFactor.ef_unit}
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
              )}
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
