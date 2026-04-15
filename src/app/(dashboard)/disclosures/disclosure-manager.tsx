'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, FileText, CheckCircle, Clock } from 'lucide-react'
import type { RegulatoryDisclosure, DisclosureFramework } from '@/types/database'

const tcfdDisclosures = [
  { id: 'GOV-A', label: 'Gobernanza — Supervisión del consejo' },
  { id: 'GOV-B', label: 'Gobernanza — Rol de la dirección' },
  { id: 'STR-A', label: 'Estrategia — Riesgos y oportunidades' },
  { id: 'STR-B', label: 'Estrategia — Impacto en el negocio' },
  { id: 'STR-C', label: 'Estrategia — Resiliencia (escenarios)' },
  { id: 'RM-A', label: 'Gestión de riesgos — Identificación' },
  { id: 'RM-B', label: 'Gestión de riesgos — Procesos de gestión' },
  { id: 'RM-C', label: 'Gestión de riesgos — Integración' },
  { id: 'MT-A', label: 'Métricas — Métricas climáticas' },
  { id: 'MT-B', label: 'Métricas — Emisiones GEI (S1, S2, S3)' },
  { id: 'MT-C', label: 'Métricas — Objetivos' },
]

const esrsDisclosures = [
  { id: 'E1-1', label: 'Plan de transición para la mitigación del cambio climático' },
  { id: 'E1-2', label: 'Políticas relacionadas con la mitigación y adaptación' },
  { id: 'E1-3', label: 'Acciones y recursos' },
  { id: 'E1-4', label: 'Objetivos de mitigación y adaptación' },
  { id: 'E1-5', label: 'Consumo de energía y mix energético' },
  { id: 'E1-6', label: 'Emisiones brutas GEI (S1, S2, S3)' },
  { id: 'E1-7', label: 'Absorciones y créditos de carbono' },
  { id: 'E1-8', label: 'Precios internos de carbono' },
  { id: 'E1-9', label: 'Efectos financieros anticipados' },
]

const statusVariant: Record<string, 'default' | 'warning' | 'success'> = {
  pending: 'default',
  in_progress: 'warning',
  completed: 'success',
}

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  completed: 'Completado',
}

interface Props {
  inventories: { id: string; fiscal_year: number; status: string }[]
  disclosures: RegulatoryDisclosure[]
}

export function DisclosureManager({ inventories, disclosures }: Props) {
  const [adding, setAdding] = useState(false)
  const [selectedInventory, setSelectedInventory] = useState(inventories[0]?.id ?? '')
  const [framework, setFramework] = useState<DisclosureFramework>('TCFD')
  const [disclosureId, setDisclosureId] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const disclosureOptions = framework === 'TCFD' ? tcfdDisclosures : esrsDisclosures

  async function handleCreate() {
    setLoading(true)
    await supabase.from('regulatory_disclosures').insert({
      inventory_id: selectedInventory,
      framework,
      disclosure_id: disclosureId,
      content: content || null,
      status: content ? 'completed' : 'pending',
    })
    setAdding(false)
    setContent('')
    setDisclosureId('')
    setLoading(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    await supabase.from('regulatory_disclosures').delete().eq('id', id)
    router.refresh()
  }

  async function handleStatusToggle(disclosure: RegulatoryDisclosure) {
    const next = disclosure.status === 'completed' ? 'pending' : 'completed'
    await supabase.from('regulatory_disclosures').update({ status: next }).eq('id', disclosure.id)
    router.refresh()
  }

  // Group by inventory
  const grouped = inventories.map(inv => ({
    ...inv,
    disclosures: disclosures.filter(d => d.inventory_id === inv.id),
  }))

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo disclosure
        </button>
      </div>

      {grouped.map(inv => (
        <div key={inv.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-zinc-500" />
              <h3 className="text-sm font-semibold text-white">Inventario {inv.fiscal_year}</h3>
            </div>
            <span className="text-xs text-zinc-500">{inv.disclosures.length} disclosures</span>
          </div>

          {inv.disclosures.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-zinc-500">Sin disclosures para este inventario</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {inv.disclosures.map(d => (
                <div key={d.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleStatusToggle(d)} className="shrink-0">
                      {d.status === 'completed' ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Clock className="h-4 w-4 text-zinc-600" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="info">{d.framework}</Badge>
                        <span className="text-sm font-mono text-zinc-300">{d.disclosure_id}</span>
                      </div>
                      {d.content && (
                        <p className="text-xs text-zinc-500 mt-0.5 max-w-lg truncate">{d.content}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusVariant[d.status]}>{statusLabel[d.status] ?? d.status}</Badge>
                    <button onClick={() => handleDelete(d.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Nuevo disclosure regulatorio</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Inventario</label>
                <select
                  value={selectedInventory}
                  onChange={(e) => setSelectedInventory(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  {inventories.map(inv => (
                    <option key={inv.id} value={inv.id}>Inventario {inv.fiscal_year}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Framework</label>
                <select
                  value={framework}
                  onChange={(e) => { setFramework(e.target.value as DisclosureFramework); setDisclosureId('') }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="TCFD">TCFD</option>
                  <option value="ESRS">ESRS</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Disclosure</label>
                <select
                  value={disclosureId}
                  onChange={(e) => setDisclosureId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Seleccionar...</option>
                  {disclosureOptions.map(d => (
                    <option key={d.id} value={d.id}>{d.id} — {d.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Contenido (opcional)</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none resize-none"
                  placeholder="Describe la divulgación..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setAdding(false)} className="rounded-lg px-3.5 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !disclosureId}
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
