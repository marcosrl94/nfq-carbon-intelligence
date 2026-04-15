'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

export function NewTargetButton({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false)
  const [framework, setFramework] = useState('SBTi')
  const [targetYear, setTargetYear] = useState(2030)
  const [reductionS1, setReductionS1] = useState('')
  const [reductionS2, setReductionS2] = useState('')
  const [reductionS3, setReductionS3] = useState('')
  const [curveType, setCurveType] = useState('linear')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleCreate() {
    setLoading(true)
    await supabase.from('decarb_targets').insert({
      organization_id: organizationId,
      framework,
      target_year: targetYear,
      reduction_s1: reductionS1 ? Number(reductionS1) : null,
      reduction_s2: reductionS2 ? Number(reductionS2) : null,
      reduction_s3: reductionS3 ? Number(reductionS3) : null,
      curve_type: curveType,
    })
    setOpen(false)
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
        Nuevo objetivo
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Nuevo objetivo de descarbonización</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Framework</label>
                <select
                  value={framework}
                  onChange={(e) => setFramework(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="SBTi">SBTi</option>
                  <option value="NZBA">NZBA</option>
                  <option value="PCAF">PCAF</option>
                  <option value="TPI">TPI</option>
                  <option value="PAB">Paris Aligned Benchmark</option>
                  <option value="Custom">Personalizado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Año objetivo</label>
                <input
                  type="number"
                  value={targetYear}
                  onChange={(e) => setTargetYear(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Reducción S1 (%)</label>
                <input
                  type="number"
                  value={reductionS1}
                  onChange={(e) => setReductionS1(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="42"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Reducción S2 (%)</label>
                <input
                  type="number"
                  value={reductionS2}
                  onChange={(e) => setReductionS2(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="42"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Reducción S3 (%)</label>
                <input
                  type="number"
                  value={reductionS3}
                  onChange={(e) => setReductionS3(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="25"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Curva de reducción</label>
                <select
                  value={curveType}
                  onChange={(e) => setCurveType(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="linear">Lineal</option>
                  <option value="exponential">Exponencial</option>
                  <option value="stepped">Escalonada</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
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
                {loading ? 'Creando...' : 'Crear objetivo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
