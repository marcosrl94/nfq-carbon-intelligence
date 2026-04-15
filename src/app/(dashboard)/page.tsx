import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/ui/header'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { Factory, Target, TrendingDown, FileCheck, AlertTriangle, CheckCircle } from 'lucide-react'
import type { InventoryStatus } from '@/types/database'

const statusBadge: Record<InventoryStatus, { label: string; variant: 'success' | 'warning' | 'default' }> = {
  draft: { label: 'Borrador', variant: 'default' },
  submitted: { label: 'Enviado', variant: 'warning' },
  verified: { label: 'Verificado', variant: 'success' },
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .single()

  const orgId = profile?.organization_id

  // Fetch inventories with emissions
  const { data: inventories } = await supabase
    .from('ghg_inventories')
    .select('*, emission_entries(*)')
    .eq('organization_id', orgId ?? '')
    .order('fiscal_year', { ascending: false })

  // Fetch targets
  const { data: targets } = await supabase
    .from('decarb_targets')
    .select('*')
    .eq('organization_id', orgId ?? '')

  // Calculate totals for latest inventory
  const latestInventory = inventories?.[0]
  const entries = latestInventory?.emission_entries ?? []

  const totalEmissions = entries.reduce((sum: number, e: { tco2e: number | null }) => sum + (e.tco2e ?? 0), 0)
  const s1Total = entries.filter((e: { scope: string }) => e.scope === 's1').reduce((sum: number, e: { tco2e: number | null }) => sum + (e.tco2e ?? 0), 0)
  const s2Total = entries.filter((e: { scope: string }) => e.scope === 's2').reduce((sum: number, e: { tco2e: number | null }) => sum + (e.tco2e ?? 0), 0)
  const s3Total = entries.filter((e: { scope: string }) => e.scope === 's3').reduce((sum: number, e: { tco2e: number | null }) => sum + (e.tco2e ?? 0), 0)

  // Previous year for trend
  const prevInventory = inventories?.[1]
  const prevEntries = prevInventory?.emission_entries ?? []
  const prevTotal = prevEntries.reduce((sum: number, e: { tco2e: number | null }) => sum + (e.tco2e ?? 0), 0)
  const trendPct = prevTotal > 0 ? Math.round(((totalEmissions - prevTotal) / prevTotal) * 100) : 0

  const activeTargets = targets?.length ?? 0

  return (
    <>
      <Header title="Dashboard" description="Resumen de huella de carbono y descarbonización" profile={profile} />

      <div className="p-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Emisiones totales"
            value={totalEmissions > 0 ? `${totalEmissions.toLocaleString('es-ES')} tCO₂e` : '—'}
            subtitle={latestInventory ? `Año fiscal ${latestInventory.fiscal_year}` : 'Sin inventarios'}
            icon={Factory}
            trend={prevTotal > 0 ? { value: trendPct, label: 'vs año anterior' } : undefined}
            variant={totalEmissions > 0 ? 'default' : 'warning'}
          />
          <StatCard
            title="Alcance 1"
            value={s1Total > 0 ? `${s1Total.toLocaleString('es-ES')}` : '—'}
            subtitle="Emisiones directas (tCO₂e)"
            icon={Factory}
            variant="danger"
          />
          <StatCard
            title="Alcance 2"
            value={s2Total > 0 ? `${s2Total.toLocaleString('es-ES')}` : '—'}
            subtitle="Electricidad comprada (tCO₂e)"
            icon={TrendingDown}
            variant="warning"
          />
          <StatCard
            title="Alcance 3"
            value={s3Total > 0 ? `${s3Total.toLocaleString('es-ES')}` : '—'}
            subtitle="Cadena de valor (tCO₂e)"
            icon={Target}
            variant="success"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inventories list */}
          <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-950/50">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Inventarios GEI</h2>
              <span className="text-xs text-zinc-500">{inventories?.length ?? 0} registros</span>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {(!inventories || inventories.length === 0) ? (
                <div className="px-6 py-12 text-center">
                  <AlertTriangle className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
                  <p className="text-sm text-zinc-400">No hay inventarios creados</p>
                  <p className="text-xs text-zinc-500 mt-1">Ve a Emisiones para crear tu primer inventario</p>
                </div>
              ) : (
                inventories.map((inv) => {
                  const invTotal = inv.emission_entries.reduce((s: number, e: { tco2e: number | null }) => s + (e.tco2e ?? 0), 0)
                  const badge = statusBadge[inv.status as InventoryStatus]
                  return (
                    <div key={inv.id} className="flex items-center justify-between px-6 py-3.5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800">
                          <span className="text-xs font-mono font-medium text-zinc-300">{inv.fiscal_year}</span>
                        </div>
                        <div>
                          <p className="text-sm text-zinc-200">Inventario {inv.fiscal_year}</p>
                          <p className="text-xs text-zinc-500">{inv.emission_entries.length} entradas · FE: {inv.ef_source}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-zinc-300">
                          {invTotal > 0 ? `${invTotal.toLocaleString('es-ES')} tCO₂e` : '—'}
                        </span>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Targets summary */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Objetivos</h2>
              <span className="text-xs text-zinc-500">{activeTargets} activos</span>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {(!targets || targets.length === 0) ? (
                <div className="px-6 py-12 text-center">
                  <Target className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
                  <p className="text-sm text-zinc-400">Sin objetivos definidos</p>
                  <p className="text-xs text-zinc-500 mt-1">Define tus objetivos de descarbonización</p>
                </div>
              ) : (
                targets.map((t) => (
                  <div key={t.id} className="px-6 py-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-zinc-200">{t.framework ?? 'Custom'}</p>
                      <span className="text-xs text-zinc-500">Meta: {t.target_year}</span>
                    </div>
                    <div className="space-y-1.5">
                      {t.reduction_s1 != null && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-zinc-800">
                            <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min(t.reduction_s1, 100)}%` }} />
                          </div>
                          <span className="text-xs text-zinc-400 w-14 text-right">S1: {t.reduction_s1}%</span>
                        </div>
                      )}
                      {t.reduction_s2 != null && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-zinc-800">
                            <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(t.reduction_s2, 100)}%` }} />
                          </div>
                          <span className="text-xs text-zinc-400 w-14 text-right">S2: {t.reduction_s2}%</span>
                        </div>
                      )}
                      {t.reduction_s3 != null && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-zinc-800">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(t.reduction_s3, 100)}%` }} />
                          </div>
                          <span className="text-xs text-zinc-400 w-14 text-right">S3: {t.reduction_s3}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 flex items-center gap-4">
            <div className="rounded-lg bg-emerald-600/20 p-2.5">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">Inventarios verificados</p>
              <p className="text-xs text-zinc-500">
                {inventories?.filter(i => i.status === 'verified').length ?? 0} de {inventories?.length ?? 0}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 flex items-center gap-4">
            <div className="rounded-lg bg-blue-600/20 p-2.5">
              <FileCheck className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">Frameworks</p>
              <p className="text-xs text-zinc-500">
                {[...new Set(targets?.map(t => t.framework).filter(Boolean))].join(', ') || 'Ninguno configurado'}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 flex items-center gap-4">
            <div className="rounded-lg bg-amber-600/20 p-2.5">
              <TrendingDown className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">Tendencia</p>
              <p className="text-xs text-zinc-500">
                {trendPct !== 0
                  ? `${trendPct > 0 ? '+' : ''}${trendPct}% vs año anterior`
                  : 'Datos insuficientes'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
