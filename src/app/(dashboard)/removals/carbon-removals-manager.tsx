'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CarbonRemoval, CarbonRemovalType } from '@/types/database'

interface Props {
  organizationId: string
  removals: CarbonRemoval[]
}

const typeLabel: Record<CarbonRemovalType, string> = {
  REC: 'REC',
  VCS: 'VCS (Verra)',
  GoldStandard: 'Gold Standard',
  PlanVivo: 'Plan Vivo',
  biochar: 'Biochar',
  DAC: 'DAC',
  afforestation: 'Afforestation',
  other: 'Otro',
}

const typeBadge: Record<CarbonRemovalType, 'success' | 'info' | 'warning' | 'default'> = {
  REC: 'warning',
  VCS: 'info',
  GoldStandard: 'success',
  PlanVivo: 'success',
  biochar: 'success',
  DAC: 'success',
  afforestation: 'success',
  other: 'default',
}

const currentYear = new Date().getFullYear()

export function CarbonRemovalsManager({ organizationId, removals }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    inventory_year: String(currentYear),
    type: 'VCS' as CarbonRemovalType,
    volume_tco2e: '',
    project_name: '',
    project_id: '',
    vintage_year: '',
    certificate_registry_url: '',
    cost_eur: '',
    retirement_date: '',
    notes: '',
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function reset() {
    setForm({
      inventory_year: String(currentYear),
      type: 'VCS',
      volume_tco2e: '',
      project_name: '',
      project_id: '',
      vintage_year: '',
      certificate_registry_url: '',
      cost_eur: '',
      retirement_date: '',
      notes: '',
    })
  }

  const yearN = Number(form.inventory_year)
  const volumeN = Number(form.volume_tco2e)
  const canSubmit =
    Number.isInteger(yearN) &&
    yearN >= 1990 &&
    yearN <= 2100 &&
    Number.isFinite(volumeN) &&
    volumeN > 0

  async function handleAdd() {
    if (!canSubmit) return
    setLoading(true)
    const payload = {
      organization_id: organizationId,
      inventory_year: yearN,
      type: form.type,
      volume_tco2e: volumeN,
      project_name: form.project_name.trim() || null,
      project_id: form.project_id.trim() || null,
      vintage_year: form.vintage_year ? Number(form.vintage_year) : null,
      certificate_registry_url: form.certificate_registry_url.trim() || null,
      cost_eur: form.cost_eur ? Number(form.cost_eur) : null,
      retirement_date: form.retirement_date || null,
      notes: form.notes.trim() || null,
    }
    const { error } = await supabase.from('carbon_removals').insert(payload)
    if (error) console.error('[carbon_removals.insert]', error)
    setLoading(false)
    reset()
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Borrar este removal?')) return
    await supabase.from('carbon_removals').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Form */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white">Nuevo removal / offset</h2>
        </div>

        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => update('type', e.target.value as CarbonRemovalType)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              {(Object.keys(typeLabel) as CarbonRemovalType[]).map((t) => (
                <option key={t} value={t}>{typeLabel[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">Año inventario</label>
            <input
              type="number"
              min={1990}
              max={2100}
              value={form.inventory_year}
              onChange={(e) => update('inventory_year', e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">Volumen (tCO₂e)</label>
            <input
              type="number"
              min={0}
              step="any"
              value={form.volume_tco2e}
              onChange={(e) => update('volume_tco2e', e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">
              Vintage <span className="text-zinc-500">(opc.)</span>
            </label>
            <input
              type="number"
              min={1990}
              max={2100}
              value={form.vintage_year}
              onChange={(e) => update('vintage_year', e.target.value)}
              placeholder="ej. 2023"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] text-zinc-400 mb-1">Proyecto</label>
            <input
              type="text"
              value={form.project_name}
              onChange={(e) => update('project_name', e.target.value)}
              placeholder="Ej. Madre de Dios REDD+"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">Project ID</label>
            <input
              type="text"
              value={form.project_id}
              onChange={(e) => update('project_id', e.target.value)}
              placeholder="VCS-1234"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">
              Coste (€) <span className="text-zinc-500">(opc.)</span>
            </label>
            <input
              type="number"
              min={0}
              step="any"
              value={form.cost_eur}
              onChange={(e) => update('cost_eur', e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] text-zinc-400 mb-1">URL registry</label>
            <input
              type="url"
              value={form.certificate_registry_url}
              onChange={(e) => update('certificate_registry_url', e.target.value)}
              placeholder="https://registry.verra.org/..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">
              Retirado el <span className="text-zinc-500">(opc.)</span>
            </label>
            <input
              type="date"
              value={form.retirement_date}
              onChange={(e) => update('retirement_date', e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="col-span-2 md:col-span-4">
            <label className="block text-[11px] text-zinc-400 mb-1">Notas</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Observaciones, alcance, contraparte…"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="col-span-2 md:col-span-4 flex justify-end">
            <button
              onClick={handleAdd}
              disabled={loading || !canSubmit}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="h-4 w-4" />
              {loading ? 'Guardando…' : 'Añadir removal'}
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {removals.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white">Removals ({removals.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                <th className="px-4 py-2 text-left text-[11px] font-medium text-zinc-500">Tipo</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-zinc-500">Año</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-zinc-500">Volumen (tCO₂e)</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-zinc-500">Proyecto</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-zinc-500">Project ID</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-zinc-500">Retirado</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {removals.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-800/20">
                  <td className="px-4 py-2">
                    <Badge variant={typeBadge[r.type]}>{typeLabel[r.type]}</Badge>
                  </td>
                  <td className="px-4 py-2 text-zinc-300">{r.inventory_year}</td>
                  <td className="px-4 py-2 text-right text-zinc-300 font-mono tabular-nums">
                    {r.volume_tco2e.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2 text-zinc-300">
                    {r.project_name ?? '—'}
                    {r.certificate_registry_url && (
                      <a
                        href={r.certificate_registry_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 ml-1.5 text-blue-400 hover:text-blue-300"
                        title="Abrir registry"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-500 font-mono text-xs">{r.project_id ?? '—'}</td>
                  <td className="px-4 py-2 text-zinc-500 text-xs">{r.retirement_date ?? '—'}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-zinc-600 hover:text-red-400 transition-colors"
                    >
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
  )
}
