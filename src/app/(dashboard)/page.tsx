import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { detectHotspots } from '@/lib/materiality/resolve'
import { Header } from '@/components/ui/header'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { Factory, Target, TrendingDown, FileCheck, AlertTriangle, CheckCircle, Info, Zap, Sprout, Minus, Equal, Calendar, Lock, Compass } from 'lucide-react'
import type { DataQualityTier, InventoryStatus } from '@/types/database'

const statusBadge: Record<InventoryStatus, { label: string; variant: 'success' | 'warning' | 'default' }> = {
  draft: { label: 'Borrador', variant: 'default' },
  submitted: { label: 'Enviado', variant: 'warning' },
  verified: { label: 'Verificado', variant: 'success' },
}

const tierLabels: Record<DataQualityTier, string> = {
  1: 'T1 Primario · supplier',
  2: 'T2 Primario · genérico',
  3: 'T3 Estimado',
}

/** Colores de los segmentos del stacked bar (consistentes con el Badge). */
const tierBarColor: Record<DataQualityTier, string> = {
  1: 'bg-emerald-500',
  2: 'bg-blue-500',
  3: 'bg-amber-500',
}

interface TierEntry {
  scope: string | null
  tco2e: number | null
  data_quality_tier: number | null
}

/** Devuelve [tco2e_t1, tco2e_t2, tco2e_t3] sumando entries (default tier = 3). */
function tco2eByTier(entries: TierEntry[]): [number, number, number] {
  const buckets: [number, number, number] = [0, 0, 0]
  for (const e of entries) {
    const t = (e.data_quality_tier ?? 3) as DataQualityTier
    buckets[t - 1] += e.tco2e ?? 0
  }
  return buckets
}

/** Weighted average por tCO2e → % por tier. */
function tierPct(entries: TierEntry[]): [number, number, number] {
  const buckets = tco2eByTier(entries)
  const sum = buckets[0] + buckets[1] + buckets[2]
  if (sum <= 0) return [0, 0, 0]
  return [
    (buckets[0] / sum) * 100,
    (buckets[1] / sum) * 100,
    (buckets[2] / sum) * 100,
  ]
}

interface BreakdownEntry {
  category: string | null
  subcategory: string | null
  tco2e: number | null
  scope: string | null
}

interface BreakdownRow {
  key: string
  category: string
  scope: string | null
  tco2e: number
  pct: number
}

/** Top N categorías por tCO₂e (snapshot — sin JOIN). */
function topActivitiesByTco2e(entries: BreakdownEntry[], n = 5): { rows: BreakdownRow[]; total: number; otherTco2e: number } {
  const groups = new Map<string, { category: string; scope: string | null; tco2e: number }>()
  for (const e of entries) {
    if (!e.category) continue
    const key = e.category
    const cur = groups.get(key) ?? { category: e.category, scope: e.scope, tco2e: 0 }
    cur.tco2e += e.tco2e ?? 0
    groups.set(key, cur)
  }
  const all = Array.from(groups.entries())
    .map(([key, v]) => ({ key, ...v }))
    .filter((g) => g.tco2e > 0)
    .sort((a, b) => b.tco2e - a.tco2e)
  const total = all.reduce((s, g) => s + g.tco2e, 0)
  const top = all.slice(0, n)
  const otherTco2e = all.slice(n).reduce((s, g) => s + g.tco2e, 0)
  const rows: BreakdownRow[] = top.map((g) => ({
    key: g.key,
    category: g.category,
    scope: g.scope,
    tco2e: g.tco2e,
    pct: total > 0 ? (g.tco2e / total) * 100 : 0,
  }))
  return { rows, total, otherTco2e }
}

const scopeBarColor: Record<string, string> = {
  s1: 'bg-red-500',
  s2: 'bg-amber-500',
  s3: 'bg-emerald-500',
}

function TierStackedBar({ entries, label }: { entries: TierEntry[]; label: string }) {
  const pct = tierPct(entries)
  const buckets = tco2eByTier(entries)
  const total = buckets[0] + buckets[1] + buckets[2]
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className="text-[11px] text-zinc-500">
          {total > 0 ? `${total.toLocaleString('es-ES', { maximumFractionDigits: 1 })} tCO₂e` : '—'}
        </span>
      </div>
      {total > 0 ? (
        <>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            {([1, 2, 3] as DataQualityTier[]).map((t) => (
              pct[t - 1] > 0 ? (
                <div
                  key={t}
                  className={tierBarColor[t]}
                  style={{ width: `${pct[t - 1]}%` }}
                  title={`${tierLabels[t]}: ${pct[t - 1].toFixed(1)}% · ${buckets[t - 1].toLocaleString('es-ES', { maximumFractionDigits: 2 })} tCO₂e`}
                />
              ) : null
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-zinc-500">
            {([1, 2, 3] as DataQualityTier[]).map((t) => (
              <span key={t} className="flex items-center gap-1">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${tierBarColor[t]}`} />
                T{t} {pct[t - 1].toFixed(0)}%
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="h-2 w-full rounded-full bg-zinc-800/60" />
      )}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const orgId = profile?.organization_id

  // Fetch inventories with emissions (incluyendo factor.s3_category para hotspots granulares)
  const { data: inventories } = await supabase
    .from('ghg_inventories')
    .select('*, emission_entries(*, emission_factors(s3_category))')
    .eq('organization_id', orgId ?? '')
    .order('fiscal_year', { ascending: false })

  // Fetch targets
  const { data: targets } = await supabase
    .from('decarb_targets')
    .select('*')
    .eq('organization_id', orgId ?? '')

  // Fetch removals (tabla SEPARADA — no neteamos contra el total)
  const { data: removals } = await supabase
    .from('carbon_removals')
    .select('inventory_year, volume_tco2e')
    .eq('organization_id', orgId ?? '')

  // Fetch organization (para base_year + threshold + sectors)
  const { data: organization } = orgId
    ? await supabase.from('organizations').select('id, name, base_year, recalc_threshold_pct, base_year_locked_at, sectors').eq('id', orgId).maybeSingle()
    : { data: null }

  // Fetch materialidad sólo si la org tiene sectores configurados
  const orgSectorList: string[] = (organization?.sectors ?? []).filter((s: string) => typeof s === 'string')
  const [{ data: matCatalog }, { data: matOverrides }] = orgSectorList.length > 0
    ? await Promise.all([
        supabase.from('industry_materiality').select('sector_code, scope_category, materiality, source_framework, notes').in('sector_code', [...orgSectorList, ...orgSectorList.map((s: string) => s.split('.')[0])]),
        supabase.from('org_materiality_overrides').select('*').eq('organization_id', orgId ?? ''),
      ])
    : [{ data: null }, { data: null }]

  // Calculate totals for latest inventory
  const latestInventory = inventories?.[0]
  const entries = latestInventory?.emission_entries ?? []

  const sumTco2e = (es: { tco2e: number | null }[]) =>
    es.reduce((sum, e) => sum + (e.tco2e ?? 0), 0)

  const s1Total = sumTco2e(entries.filter((e: { scope: string }) => e.scope === 's1'))
  const s3Total = sumTco2e(entries.filter((e: { scope: string }) => e.scope === 's3'))

  // GHG Protocol Scope 2 dual reporting:
  // location-based usa la intensidad media de la red, market-based los
  // contratos. Para evitar double-counting en el total, el headline usa
  // location-based (default GHG Protocol). market-based se reporta aparte.
  const s2Entries = entries.filter((e: { scope: string }) => e.scope === 's2')
  const s2Location = sumTco2e(
    s2Entries.filter((e: { scope2_method: string | null }) =>
      e.scope2_method === 'location_based' || e.scope2_method == null
    )
  )
  const s2Market = sumTco2e(
    s2Entries.filter((e: { scope2_method: string | null }) => e.scope2_method === 'market_based')
  )
  const hasS2Market = s2Market > 0

  const totalEmissions = s1Total + s2Location + s3Total
  const totalEmissionsMarket = hasS2Market ? s1Total + s2Market + s3Total : null

  // Breakdown por categoría (top 5) con la misma convención de S2 que el headline.
  const breakdownEntries = entries.filter((e: { scope: string; scope2_method: string | null }) => {
    if (e.scope === 's2') return e.scope2_method === 'location_based' || e.scope2_method == null
    return true
  }) as BreakdownEntry[]
  const breakdown = topActivitiesByTco2e(breakdownEntries, 5)

  // Base year vs current — comparar contra el año designado (si existe).
  // Usamos el mismo criterio location-based para la comparación.
  const baseYearVal = organization?.base_year ?? null
  const baseInventory = baseYearVal != null
    ? inventories?.find((i: { fiscal_year: number }) => i.fiscal_year === baseYearVal)
    : null
  const baseEntries = baseInventory?.emission_entries ?? []
  const baseS1 = sumTco2e(baseEntries.filter((e: { scope: string }) => e.scope === 's1'))
  const baseS3 = sumTco2e(baseEntries.filter((e: { scope: string }) => e.scope === 's3'))
  const baseS2Loc = sumTco2e(
    baseEntries.filter((e: { scope: string; scope2_method: string | null }) =>
      e.scope === 's2' && (e.scope2_method === 'location_based' || e.scope2_method == null)
    )
  )
  const baseTotal = baseS1 + baseS2Loc + baseS3
  const vsBasePct = baseTotal > 0 ? ((totalEmissions - baseTotal) / baseTotal) * 100 : null
  const exceedsThreshold = vsBasePct != null && Math.abs(vsBasePct) >= Number(organization?.recalc_threshold_pct ?? 5)
  const baseYearLocked = organization?.base_year_locked_at != null

  // Hotspots de materialidad sin cubrir (count para banner). El detalle vive en
  // /materiality. Mismo helper compartido para no divergir lógicas.
  const matHotspots =
    matCatalog && orgSectorList.length > 0
      ? detectHotspots(
          orgSectorList,
          entries as Parameters<typeof detectHotspots>[1],
          matCatalog as Parameters<typeof detectHotspots>[2],
          (matOverrides ?? []) as Parameters<typeof detectHotspots>[3]
        )
      : []
  const matHotspotsCount = matHotspots.length

  // Removals/offsets — SEPARADO del total. Filtramos al año del inventario actual.
  const latestYear = latestInventory?.fiscal_year
  const removalsForYear = (removals ?? [])
    .filter((r: { inventory_year: number }) => latestYear == null || r.inventory_year === latestYear)
    .reduce((sum: number, r: { volume_tco2e: number }) => sum + (r.volume_tco2e ?? 0), 0)
  const removalsAllYears = (removals ?? [])
    .reduce((sum: number, r: { volume_tco2e: number }) => sum + (r.volume_tco2e ?? 0), 0)
  const netEmissions = Math.max(0, totalEmissions - removalsForYear)

  // Previous year for trend (mismo criterio location-based como headline)
  const prevInventory = inventories?.[1]
  const prevEntries = prevInventory?.emission_entries ?? []
  const prevS2Loc = sumTco2e(
    prevEntries.filter((e: { scope: string; scope2_method: string | null }) =>
      e.scope === 's2' && (e.scope2_method === 'location_based' || e.scope2_method == null)
    )
  )
  const prevS1 = sumTco2e(prevEntries.filter((e: { scope: string }) => e.scope === 's1'))
  const prevS3 = sumTco2e(prevEntries.filter((e: { scope: string }) => e.scope === 's3'))
  const prevTotal = prevS1 + prevS2Loc + prevS3
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
          {/* Scope 2 dual reporting (location + market). */}
          <div className="rounded-xl border bg-amber-950/30 border-amber-800/30 p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-zinc-400">Alcance 2</p>
              <div className="rounded-lg p-2.5 bg-amber-600/20 text-amber-400">
                <Zap className="h-5 w-5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Location</p>
                <p className="text-xl font-semibold text-white tabular-nums">
                  {s2Location > 0 ? s2Location.toLocaleString('es-ES', { maximumFractionDigits: 1 }) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Market</p>
                <p className="text-xl font-semibold text-white tabular-nums">
                  {hasS2Market ? s2Market.toLocaleString('es-ES', { maximumFractionDigits: 1 }) : '—'}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500">Electricidad (tCO₂e) — dual reporting</p>
          </div>
          <StatCard
            title="Alcance 3"
            value={s3Total > 0 ? `${s3Total.toLocaleString('es-ES')}` : '—'}
            subtitle="Cadena de valor (tCO₂e)"
            icon={Target}
            variant="success"
          />
        </div>

        {/* Nota pedagógica GHG Protocol Scope 2 Guidance */}
        <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs text-zinc-300 leading-relaxed">
            <span className="font-semibold text-blue-300">GHG Protocol Scope 2 Guidance</span> exige reportar
            electricidad bajo ambos métodos. <strong>Location-based</strong> ({s2Location > 0 ? `${s2Location.toLocaleString('es-ES', { maximumFractionDigits: 1 })} tCO₂e` : '—'})
            usa el factor del mix de la red. <strong>Market-based</strong> ({hasS2Market ? `${s2Market.toLocaleString('es-ES', { maximumFractionDigits: 1 })} tCO₂e` : '—'})
            usa los instrumentos contractuales (GoOs/RECs/PPAs) o el residual mix.
            {!hasS2Market && (
              <>
                {' '}<span className="text-amber-300">Aún no hay entradas market-based.</span>{' '}
                <Link href="/settings/renewable-energy" className="underline text-blue-300 hover:text-blue-200">
                  Declara tus instrumentos
                </Link>{' '}para empezar.
              </>
            )}
            {totalEmissionsMarket != null && (
              <>
                {' '}Total inventario market-based: <strong>{totalEmissionsMarket.toLocaleString('es-ES', { maximumFractionDigits: 1 })} tCO₂e</strong>.
              </>
            )}
          </div>
        </div>

        {/* Gross / Removals / Net — siempre las 3 líneas. NO mostrar solo Net. */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <div>
              <h2 className="text-sm font-semibold text-white">Gross · Removals · Net</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                GHG Protocol & ESRS exigen mostrar las tres líneas separadas{latestYear ? ` · año ${latestYear}` : ''}
              </p>
            </div>
            <Link
              href="/removals"
              className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors inline-flex items-center gap-1"
            >
              Gestionar removals →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
            <div className="p-5 flex items-start gap-3">
              <div className="rounded-lg bg-zinc-700/40 p-2 shrink-0">
                <Factory className="h-4 w-4 text-zinc-300" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Gross emissions</p>
                <p className="text-2xl font-semibold text-white tabular-nums mt-0.5">
                  {totalEmissions > 0 ? totalEmissions.toLocaleString('es-ES', { maximumFractionDigits: 1 }) : '—'}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">tCO₂e (location-based)</p>
              </div>
            </div>
            <div className="p-5 flex items-start gap-3">
              <div className="rounded-lg bg-emerald-600/15 p-2 shrink-0">
                <Sprout className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                  <Minus className="h-2.5 w-2.5" /> Removals & offsets
                </p>
                <p className="text-2xl font-semibold text-emerald-400 tabular-nums mt-0.5">
                  {removalsForYear > 0 ? removalsForYear.toLocaleString('es-ES', { maximumFractionDigits: 1 }) : '—'}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  tCO₂e {removalsAllYears > removalsForYear && `· ${removalsAllYears.toLocaleString('es-ES', { maximumFractionDigits: 1 })} todos los años`}
                </p>
              </div>
            </div>
            <div className="p-5 flex items-start gap-3">
              <div className="rounded-lg bg-blue-600/15 p-2 shrink-0">
                <Equal className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Net emissions</p>
                <p className="text-2xl font-semibold text-blue-300 tabular-nums mt-0.5">
                  {(totalEmissions > 0 || removalsForYear > 0)
                    ? netEmissions.toLocaleString('es-ES', { maximumFractionDigits: 1 })
                    : '—'}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">tCO₂e (informativo)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Materiality hotspots banner */}
        {matHotspotsCount > 0 && (
          <Link
            href="/materiality"
            className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 hover:bg-amber-500/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-600/20 p-2 shrink-0">
                <Compass className="h-4 w-4 text-amber-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {matHotspotsCount} hotspot{matHotspotsCount === 1 ? '' : 's'} de materialidad sin cubrir
                </p>
                <p className="text-[11px] text-zinc-400">
                  Tu sector sugiere categorías material{matHotspotsCount === 1 ? '' : 'es'} sin entradas de tCO₂e en el inventario {latestInventory?.fiscal_year ?? 'actual'}.
                </p>
              </div>
            </div>
            <span className="text-[11px] text-amber-300">Revisar matriz →</span>
          </Link>
        )}

        {/* vs Base Year — GHG Protocol §5 */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 flex items-center gap-4 flex-wrap">
          <div className="rounded-lg bg-blue-600/15 p-2.5 shrink-0">
            <Calendar className="h-5 w-5 text-blue-400" />
          </div>
          {baseYearVal != null && baseTotal > 0 ? (
            <>
              <div className="flex-1 min-w-[200px]">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  vs Año base {baseYearVal}
                  {baseYearLocked && <Lock className="h-3 w-3 text-blue-400" aria-label="locked" />}
                </p>
                <p className={`text-2xl font-semibold tabular-nums mt-0.5 ${
                  vsBasePct != null && vsBasePct < 0 ? 'text-emerald-400' : vsBasePct != null && vsBasePct > 0 ? 'text-red-400' : 'text-zinc-300'
                }`}>
                  {vsBasePct != null ? `${vsBasePct > 0 ? '+' : ''}${vsBasePct.toFixed(1)}%` : '—'}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {baseTotal.toLocaleString('es-ES', { maximumFractionDigits: 1 })} → {totalEmissions.toLocaleString('es-ES', { maximumFractionDigits: 1 })} tCO₂e
                </p>
              </div>
              {exceedsThreshold && vsBasePct != null && vsBasePct > 0 && (
                <div className="text-[11px] text-amber-300 max-w-md flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    El cambio supera tu threshold ({Number(organization?.recalc_threshold_pct ?? 5).toFixed(1)}%). Si es por
                    cambio estructural, considera recalcular el año base.
                  </span>
                </div>
              )}
              <Link
                href="/settings/base-year"
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors ml-auto"
              >
                Configurar →
              </Link>
            </>
          ) : (
            <>
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-medium text-white">Año base sin configurar</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  GHG Protocol §5: fija un año de referencia para medir progreso de descarbonización.
                </p>
              </div>
              <Link
                href="/settings/base-year"
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Designar año base
              </Link>
            </>
          )}
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

        {/* Calidad del dato (ESRS/CSRD) — weighted average por tCO2e */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <div>
              <h2 className="text-sm font-semibold text-white">Calidad del dato</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Mix de tiers ESRS por tCO₂e en {latestInventory ? `el inventario ${latestInventory.fiscal_year}` : 'el último inventario'}
              </p>
            </div>
            <div className="hidden md:flex items-center gap-3 text-[10px] text-zinc-500">
              {([1, 2, 3] as DataQualityTier[]).map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className={`inline-block h-2 w-2 rounded-full ${tierBarColor[t]}`} />
                  {tierLabels[t]}
                </span>
              ))}
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <TierStackedBar entries={entries} label="Total inventario" />
            <TierStackedBar entries={entries.filter((e: { scope: string }) => e.scope === 's1')} label="Alcance 1" />
            <TierStackedBar entries={entries.filter((e: { scope: string }) => e.scope === 's2')} label="Alcance 2" />
            <TierStackedBar entries={entries.filter((e: { scope: string }) => e.scope === 's3')} label="Alcance 3" />
          </div>
        </div>

        {/* Dónde está el carbono — breakdown top N por categoría */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <div>
              <h2 className="text-sm font-semibold text-white">Dónde está el carbono</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Top 5 categorías del inventario {latestYear ?? 'actual'} (snapshot, sin JOIN)
              </p>
            </div>
            <span className="text-[11px] text-zinc-500 tabular-nums">
              {breakdown.total > 0 ? `${breakdown.total.toLocaleString('es-ES', { maximumFractionDigits: 1 })} tCO₂e total` : '—'}
            </span>
          </div>
          <div className="p-6 space-y-3">
            {breakdown.rows.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">Sin entradas con tCO₂e &gt; 0 en el último inventario.</p>
            ) : (
              <>
                {breakdown.rows.map((row) => (
                  <div key={row.key}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant={row.scope === 's1' ? 'danger' : row.scope === 's2' ? 'warning' : 'success'}>
                          {String(row.scope ?? '').toUpperCase() || '—'}
                        </Badge>
                        <span className="text-xs text-zinc-300 truncate">{row.category}</span>
                      </div>
                      <span className="text-[11px] text-zinc-400 tabular-nums shrink-0 ml-2">
                        {row.tco2e.toLocaleString('es-ES', { maximumFractionDigits: 1 })} tCO₂e · {row.pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-800">
                      <div
                        className={`h-full rounded-full ${scopeBarColor[row.scope ?? ''] ?? 'bg-zinc-500'}`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
                {breakdown.otherTco2e > 0 && (
                  <p className="text-[11px] text-zinc-500 italic pt-1">
                    + {breakdown.otherTco2e.toLocaleString('es-ES', { maximumFractionDigits: 1 })} tCO₂e en otras categorías ({((breakdown.otherTco2e / breakdown.total) * 100).toFixed(1)}%)
                  </p>
                )}
              </>
            )}
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
