'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { RenewableInstrument, RenewableInstrumentType } from '@/types/database'

interface Props {
  organizationId: string
  instruments: RenewableInstrument[]
}

const typeLabel: Record<RenewableInstrumentType, string> = {
  GoO: 'GoO',
  REC: 'REC',
  PPA: 'PPA',
  green_tariff: 'Tarifa verde',
}

const typeBadge: Record<RenewableInstrumentType, 'success' | 'info' | 'warning' | 'default'> = {
  GoO: 'success',
  REC: 'success',
  PPA: 'info',
  green_tariff: 'warning',
}

const currentYear = new Date().getFullYear()

export function RenewableInstrumentsManager({ organizationId, instruments }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    year: String(currentYear),
    type: 'GoO' as RenewableInstrumentType,
    volume_kwh: '',
    vintage_year: '',
    certificate_id: '',
    supplier: '',
    cost_eur: '',
    retirement_date: '',
    notes: '',
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function reset() {
    setForm({
      year: String(currentYear),
      type: 'GoO',
      volume_kwh: '',
      vintage_year: '',
      certificate_id: '',
      supplier: '',
      cost_eur: '',
      retirement_date: '',
      notes: '',
    })
  }

  const yearN = Number(form.year)
  const volumeN = Number(form.volume_kwh)
  const canSubmit =
    Number.isFinite(yearN) &&
    yearN >= 1990 &&
    yearN <= 2100 &&
    Number.isFinite(volumeN) &&
    volumeN > 0

  async function handleAdd() {
    if (!canSubmit) return
    setLoading(true)
    const payload = {
      organization_id: organizationId,
      year: yearN,
      type: form.type,
      volume_kwh: volumeN,
      vintage_year: form.vintage_year ? Number(form.vintage_year) : null,
      certificate_id: form.certificate_id.trim() || null,
      supplier: form.supplier.trim() || null,
      cost_eur: form.cost_eur ? Number(form.cost_eur) : null,
      retirement_date: form.retirement_date || null,
      notes: form.notes.trim() || null,
    }
    const { error } = await supabase.from('renewable_instruments').insert(payload)
    if (error) console.error('[renewable_instruments.insert]', error)
    setLoading(false)
    reset()
    router.refresh()
  }

  async function handleDelete(id: string) {
    await supabase.from('renewable_instruments').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Form */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white">Nuevo instrumento</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Volumen, tipo y certificado</p>
        </div>

        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => update('type', e.target.value as RenewableInstrumentType)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="GoO">GoO (Garantía de Origen)</option>
              <option value="REC">REC</option>
              <option value="PPA">PPA</option>
              <option value="green_tariff">Tarifa verde</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">Año reporting</label>
            <input
              type="number"
              min={1990}
              max={2100}
              value={form.year}
              onChange={(e) => update('year', e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">Volumen (kWh)</label>
            <input
              type="number"
              min={0}
              step="any"
              value={form.volume_kwh}
              onChange={(e) => update('volume_kwh', e.target.value)}
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
              placeholder="ej. 2024"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">Suministrador</label>
            <input
              type="text"
              value={form.supplier}
              onChange={(e) => update('supplier', e.target.value)}
              placeholder="Iberdrola, Endesa…"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">ID certificado</label>
            <input
              type="text"
              value={form.certificate_id}
              onChange={(e) => update('certificate_id', e.target.value)}
              placeholder="ej. ES-AIB-1234"
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
              placeholder="0"
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
              placeholder="Observaciones, ámbito de aplicación, contrato…"
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
              {loading ? 'Guardando…' : 'Añadir instrumento'}
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {instruments.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white">Instrumentos ({instruments.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                <th className="px-4 py-2 text-left text-[11px] font-medium text-zinc-500">Tipo</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-zinc-500">Año</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-zinc-500">Volumen (kWh)</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-zinc-500">Suministrador</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-zinc-500">Certificado</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-zinc-500">Retirado</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {instruments.map((i) => (
                <tr key={i.id} className="hover:bg-zinc-800/20">
                  <td className="px-4 py-2">
                    <Badge variant={typeBadge[i.type]}>{typeLabel[i.type]}</Badge>
                  </td>
                  <td className="px-4 py-2 text-zinc-300">{i.year}</td>
                  <td className="px-4 py-2 text-right text-zinc-300 font-mono tabular-nums">
                    {i.volume_kwh.toLocaleString('es-ES')}
                  </td>
                  <td className="px-4 py-2 text-zinc-400">{i.supplier ?? '—'}</td>
                  <td className="px-4 py-2 text-zinc-500 font-mono text-xs">{i.certificate_id ?? '—'}</td>
                  <td className="px-4 py-2 text-zinc-500 text-xs">{i.retirement_date ?? '—'}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleDelete(i.id)}
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
