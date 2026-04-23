'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { EmissionEntry, GHGInventory, Scope } from '@/types/database'

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

const s1Categories = ['Combustión fija', 'Combustión móvil', 'Emisiones de proceso', 'Emisiones fugitivas']
const s2Categories = ['Electricidad comprada', 'Calor/vapor comprado']
const s3Categories = [
  'Bienes y servicios comprados', 'Bienes de capital', 'Combustibles y energía',
  'Transporte upstream', 'Residuos', 'Viajes de negocios', 'Desplazamiento empleados',
  'Activos arrendados upstream', 'Transporte downstream', 'Procesamiento de productos vendidos',
  'Uso de productos vendidos', 'Fin de vida de productos', 'Activos arrendados downstream',
  'Franquicias', 'Inversiones',
]

function getCategoriesForScope(scope: Scope): string[] {
  if (scope === 's1') return s1Categories
  if (scope === 's2') return s2Categories
  return s3Categories
}

interface Props {
  inventory: GHGInventory
  entries: EmissionEntry[]
}

export function InventoryDetail({ inventory, entries }: Props) {
  const [adding, setAdding] = useState(false)
  const [scope, setScope] = useState<Scope>('s1')
  const [category, setCategory] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('kWh')
  const [efValue, setEfValue] = useState('')
  const [tco2e, setTco2e] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleAdd() {
    setLoading(true)
    const q = quantity ? Number(quantity) : null
    const ef = efValue ? Number(efValue) : null
    const manualT = tco2e ? Number(tco2e) : null
    const tco2eFinal =
      manualT != null && !Number.isNaN(manualT)
        ? manualT
        : q != null && ef != null && !Number.isNaN(q) && !Number.isNaN(ef)
          ? q * ef
          : null
    await supabase.from('emission_entries').insert({
      inventory_id: inventory.id,
      scope,
      category: category || null,
      quantity: q,
      unit: unit || null,
      ef_value: ef,
      ef_source: inventory.ef_source || null,
      tco2e: tco2eFinal,
    })
    setAdding(false)
    setScope('s1')
    setCategory('')
    setQuantity('')
    setUnit('kWh')
    setEfValue('')
    setTco2e('')
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Nueva entrada de emisión</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Alcance</label>
                <select
                  value={scope}
                  onChange={(e) => { setScope(e.target.value as Scope); setCategory('') }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="s1">Alcance 1 — Directas</option>
                  <option value="s2">Alcance 2 — Electricidad</option>
                  <option value="s3">Alcance 3 — Cadena de valor</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Categoría</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Seleccionar...</option>
                  {getCategoriesForScope(scope).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Cantidad</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Unidad</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="kWh">kWh</option>
                  <option value="MWh">MWh</option>
                  <option value="L">Litros</option>
                  <option value="m3">m³</option>
                  <option value="kg">kg</option>
                  <option value="t">Toneladas</option>
                  <option value="km">km</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Factor de emisión</label>
                <input
                  type="number"
                  step="0.0001"
                  value={efValue}
                  onChange={(e) => setEfValue(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="kgCO₂e/unidad"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">tCO₂e</label>
                <input
                  type="number"
                  step="0.01"
                  value={tco2e}
                  onChange={(e) => setTco2e(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="Total (opcional: cantidad × FE)"
                />
              </div>
            </div>
            <p className="text-[11px] text-zinc-500">
              Si dejas tCO₂e vacío y rellenas cantidad y factor, se calcula como cantidad × FE (misma unidad de referencia del FE).
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setAdding(false)}
                className="rounded-lg px-3.5 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdd}
                disabled={loading}
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
