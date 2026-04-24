'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Organization, Profile } from '@/types/database'

interface Props {
  organization: Organization | null
  profile: Profile | null
}

export function OrganizationForm({ organization, profile }: Props) {
  const [name, setName] = useState(organization?.name ?? '')
  const [sectors, setSectors] = useState(organization?.sectors?.join(', ') ?? '')
  const [geographies, setGeographies] = useState(organization?.geographies?.join(', ') ?? '')
  const [employees, setEmployees] = useState(organization?.employees?.toString() ?? '')
  const [revenue, setRevenue] = useState(organization?.revenue_eur_m?.toString() ?? '')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSave() {
    setLoading(true)
    setSaved(false)
    setError(null)

    const base = {
      name,
      sectors: sectors.split(',').map(s => s.trim()).filter(Boolean),
      geographies: geographies.split(',').map(s => s.trim()).filter(Boolean),
      employees: employees ? Number(employees) : null,
      revenue_eur_m: revenue ? Number(revenue) : null,
    }
    const data = organization
      ? base
      : {
          ...base,
          consolidation: 'operational' as const,
          fiscal_year: new Date().getFullYear(),
        }

    if (organization) {
      const { error: uerr } = await supabase.from('organizations').update(data).eq('id', organization.id)
      if (uerr) {
        setError(
          uerr.message +
            (uerr.hint ? ` — ${uerr.hint}` : '') +
            ' (revisa RLS: debes ser miembro de la org; columna `consolidation` requerida, etc.)'
        )
        setLoading(false)
        return
      }
    } else {
      const { data: newOrg, error: oerr } = await supabase.from('organizations').insert(data).select().single()
      if (oerr) {
        setError(oerr.message)
        setLoading(false)
        return
      }
      if (newOrg && profile) {
        const { error: perr } = await supabase
          .from('profiles')
          .update({ organization_id: newOrg.id })
          .eq('id', profile.id)
        if (perr) {
          setError('Organización creada, pero no se pudo enlazar el perfil: ' + perr.message)
          setLoading(false)
          return
        }
      }
    }

    setLoading(false)
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50">
      <div className="px-6 py-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white">Organización</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Datos generales de tu organización</p>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="Mi Organización S.A."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Sectores (separados por coma)</label>
            <input
              value={sectors}
              onChange={(e) => setSectors(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Financiero, Energía"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Geografías (separados por coma)</label>
            <input
              value={geographies}
              onChange={(e) => setGeographies(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="España, Portugal"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Empleados</label>
            <input
              type="number"
              value={employees}
              onChange={(e) => setEmployees(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Ingresos (EUR M)</label>
            <input
              type="number"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="120"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={loading || !name}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
          {saved && <span className="text-xs text-emerald-400">Guardado correctamente</span>}
        </div>
      </div>
    </div>
  )
}
