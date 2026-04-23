import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/ui/header'
import { EmptyState } from '@/components/ui/empty-state'
import { Target } from 'lucide-react'
import { NewTargetButton } from './new-target-button'
import { TargetCard } from './target-card'

export default async function TargetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id ?? '').single()
  const orgId = profile?.organization_id

  const { data: targets } = await supabase
    .from('decarb_targets')
    .select('*')
    .eq('organization_id', orgId ?? '')
    .order('target_year', { ascending: true })

  // Get latest inventory totals per scope for progress calculation
  const { data: inventories } = await supabase
    .from('ghg_inventories')
    .select('fiscal_year, emission_entries(scope, tco2e)')
    .eq('organization_id', orgId ?? '')
    .order('fiscal_year', { ascending: false })
    .limit(2)

  const latestEntries = inventories?.[0]?.emission_entries ?? []
  const baselineEntries = inventories?.[inventories.length - 1]?.emission_entries ?? []

  const currentByScope = {
    s1: latestEntries.filter((e: { scope: string }) => e.scope === 's1').reduce((s: number, e: { tco2e: number | null }) => s + (e.tco2e ?? 0), 0),
    s2: latestEntries.filter((e: { scope: string }) => e.scope === 's2').reduce((s: number, e: { tco2e: number | null }) => s + (e.tco2e ?? 0), 0),
    s3: latestEntries.filter((e: { scope: string }) => e.scope === 's3').reduce((s: number, e: { tco2e: number | null }) => s + (e.tco2e ?? 0), 0),
  }

  const baselineByScope = {
    s1: baselineEntries.filter((e: { scope: string }) => e.scope === 's1').reduce((s: number, e: { tco2e: number | null }) => s + (e.tco2e ?? 0), 0),
    s2: baselineEntries.filter((e: { scope: string }) => e.scope === 's2').reduce((s: number, e: { tco2e: number | null }) => s + (e.tco2e ?? 0), 0),
    s3: baselineEntries.filter((e: { scope: string }) => e.scope === 's3').reduce((s: number, e: { tco2e: number | null }) => s + (e.tco2e ?? 0), 0),
  }

  return (
    <>
      <Header title="Objetivos de descarbonización" description="Define y monitoriza tus metas de reducción de emisiones" profile={profile}>
        {orgId && <NewTargetButton organizationId={orgId} />}
      </Header>

      <div className="p-8">
        {(!targets || targets.length === 0) ? (
          <EmptyState
            icon={Target}
            title="Sin objetivos"
            description="Define tus objetivos de descarbonización alineados con SBTi, NZBA u otros frameworks para monitorizar tu progreso."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {targets.map((t) => (
              <TargetCard
                key={t.id}
                target={t}
                currentByScope={currentByScope}
                baselineByScope={baselineByScope}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
