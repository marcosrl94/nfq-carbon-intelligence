import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/ui/header'
import { EmptyState } from '@/components/ui/empty-state'
import { Sprout } from 'lucide-react'
import { CarbonRemovalsManager } from './carbon-removals-manager'
import type { CarbonRemoval } from '@/types/database'

export default async function RemovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const orgId = profile?.organization_id

  const { data: removals } = orgId
    ? await supabase
        .from('carbon_removals')
        .select('*')
        .eq('organization_id', orgId)
        .order('inventory_year', { ascending: false })
        .order('created_at', { ascending: false })
    : { data: null }

  return (
    <>
      <Header title="Removals & Offsets" description="Reducciones de carbono — registro separado de emisiones brutas" profile={profile} />

      <div className="p-8 space-y-6 max-w-5xl">
        {/* Nota pedagógica */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h2 className="text-sm font-semibold text-amber-300 mb-1.5">
            Por qué esta tabla está separada
          </h2>
          <p className="text-xs text-zinc-300 leading-relaxed">
            <strong>GHG Protocol</strong> y <strong>ESRS</strong> exigen no netear removals/offsets contra
            emisiones brutas. El dashboard mostrará siempre tres líneas:{' '}
            <strong>Gross emissions</strong>, <strong>Removals/Offsets</strong> y{' '}
            <strong>Net</strong> — nunca solo Net. Ahí registras los certificados (REC, VCS, Gold Standard,
            biochar, DAC, afforestation…) que la organización ha retirado.
          </p>
        </div>

        {orgId ? (
          <>
            <CarbonRemovalsManager
              organizationId={orgId}
              removals={(removals ?? []) as CarbonRemoval[]}
            />
            {(!removals || removals.length === 0) && (
              <EmptyState
                icon={Sprout}
                title="Sin removals registrados"
                description="Añade el primer certificado retirado (REC, VCS, biochar, DAC…) para que aparezca en el dashboard como reducción separada de las emisiones brutas."
              />
            )}
          </>
        ) : (
          <p className="text-xs text-zinc-500">Necesitas pertenecer a una organización para gestionar removals.</p>
        )}
      </div>
    </>
  )
}
