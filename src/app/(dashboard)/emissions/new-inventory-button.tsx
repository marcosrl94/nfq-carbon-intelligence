'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

const EF_PRESETS = [
  { value: 'DEFRA 2024 (UK)', label: 'DEFRA 2024 (Reino Unido)' },
  { value: 'IPCC AR6', label: 'IPCC AR6' },
  { value: 'IEA', label: 'IEA' },
  { value: 'Factor interno (custom)', label: 'Factor interno / ad-hoc' },
] as const

export function NewInventoryButton({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [efSource, setEfSource] = useState<string>(EF_PRESETS[0].value)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleCreate() {
    setError(null)
    setLoading(true)
    const { error: insErr } = await supabase.from('ghg_inventories').insert({
      organization_id: organizationId,
      fiscal_year: year,
      ef_source: efSource,
      status: 'draft',
    })
    if (insErr) {
      setError(insErr.message)
      setLoading(false)
      return
    }
    setOpen(false)
    setEfSource(EF_PRESETS[0].value)
    setLoading(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Nuevo inventario
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Nuevo inventario GEI</h3>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Año fiscal</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Catálogo / fuente de factores (FE)</label>
              <select
                value={efSource}
                onChange={(e) => setEfSource(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {EF_PRESETS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {error && (
              <p className="text-xs text-red-400" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-3.5 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
