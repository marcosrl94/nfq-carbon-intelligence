import Link from 'next/link'
import { ArrowLeft, Calendar, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/ui/header'
import { BaseYearForm } from './base-year-form'
import { RecalculationsSection } from './recalculations-section'
import type { BaseYearMetadata, BaseYearRecalculation, GHGInventory, Organization } from '@/types/database'

export default async function BaseYearPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const orgId = profile?.organization_id

  // Guard admin-only
  if (profile?.role !== 'admin') {
    return (
      <>
        <Header title="Año base GHG Protocol" description="Acceso restringido" profile={profile} />
        <div className="p-8">
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 max-w-xl">
            <h2 className="text-sm font-semibold text-red-300 mb-1.5">Forbidden</h2>
            <p className="text-xs text-zinc-300">
              La gestión del año base sólo es accesible para administradores.
              Tu rol actual es <code className="text-zinc-200">{profile?.role ?? 'sin asignar'}</code>.
            </p>
          </div>
        </div>
      </>
    )
  }

  const { data: organization } = orgId
    ? await supabase.from('organizations').select('*').eq('id', orgId).maybeSingle()
    : { data: null }

  // Sólo permitimos elegir base year sobre inventarios verified (lo recomendado).
  // Mostramos también drafts/submitted pero los marcamos como menos fiables.
  const { data: inventories } = orgId
    ? await supabase
        .from('ghg_inventories')
        .select('id, fiscal_year, status, ef_source')
        .eq('organization_id', orgId)
        .order('fiscal_year', { ascending: true })
    : { data: null }

  const { data: history } = orgId
    ? await supabase
        .from('base_year_metadata')
        .select('*')
        .eq('organization_id', orgId)
        .order('set_at', { ascending: false })
    : { data: null }

  const { data: recalculations } = orgId
    ? await supabase
        .from('base_year_recalculations')
        .select('*')
        .eq('organization_id', orgId)
        .order('proposed_at', { ascending: false })
    : { data: null }

  return (
    <>
      <Header title="Año base GHG Protocol" description="Designación, threshold de recálculo y trazabilidad" profile={profile} />

      <div className="p-8 space-y-6 max-w-3xl">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver a Configuración
        </Link>

        {/* Nota pedagógica */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
          <h2 className="text-sm font-semibold text-blue-300 mb-1.5 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Qué es el año base
          </h2>
          <p className="text-xs text-zinc-300 leading-relaxed">
            El <strong>GHG Protocol Corporate Standard §5</strong> exige fijar un año de referencia
            ("base year") contra el que se mide el progreso de descarbonización. Debe ser un año
            verificado, representativo, y sólo se recalcula cuando hay <strong>cambios estructurales
            significativos</strong>: adquisiciones, desinversiones, cambios de metodología, actualizaciones
            de factores de emisión o correcciones de errores que excedan el <strong>threshold</strong> que
            configures abajo (default 5%).
          </p>
          <p className="text-xs text-zinc-300 leading-relaxed mt-2">
            <strong>Locked</strong> indica que el año base no puede cambiarse sin un proceso explícito
            (próximamente: gestor de recálculos en /settings/base-year/recalc).
          </p>
        </div>

        {/* Si no hay inventario verified, aviso */}
        {(!inventories || inventories.filter((i) => i.status === 'verified').length === 0) && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs text-zinc-300 leading-relaxed">
              Aún no tienes inventarios <strong>verified</strong>. GHG Protocol recomienda usar un año verificado
              como base; puedes elegir un draft / submitted ahora pero conviene re-fijarlo cuando esté verificado.
            </div>
          </div>
        )}

        {orgId && organization && (
          <>
            <BaseYearForm
              organization={organization as Organization}
              inventories={(inventories ?? []) as Pick<GHGInventory, 'id' | 'fiscal_year' | 'status' | 'ef_source'>[]}
            />
            <RecalculationsSection
              recalculations={(recalculations ?? []) as BaseYearRecalculation[]}
              hasBaseYear={(organization as Organization).base_year != null}
              thresholdPct={Number((organization as Organization).recalc_threshold_pct ?? 5)}
            />
          </>
        )}

        {/* Historial */}
        {history && history.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Historial</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">Inmutable. {history.length} {history.length === 1 ? 'cambio' : 'cambios'}.</p>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {(history as BaseYearMetadata[]).map((h) => {
                const isActive = h.superseded_at == null
                return (
                  <div key={h.id} className="px-6 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-200">
                        Año base <span className="font-mono font-medium">{h.base_year}</span>
                        {isActive && <span className="ml-2 text-[10px] text-emerald-400 uppercase tracking-wider">activo</span>}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Fijado el {new Date(h.set_at).toLocaleString('es-ES')}
                        {h.superseded_at && ` · reemplazado el ${new Date(h.superseded_at).toLocaleDateString('es-ES')}`}
                      </p>
                      {h.reason && (
                        <p className="text-[11px] text-zinc-400 mt-1 italic">"{h.reason}"</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
