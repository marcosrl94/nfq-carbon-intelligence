import Link from 'next/link'
import { ArrowLeft, Leaf } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/ui/header'
import { EmptyState } from '@/components/ui/empty-state'
import { RenewableInstrumentsManager } from './renewable-instruments-manager'
import type { RenewableInstrument } from '@/types/database'

export default async function RenewableEnergyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const orgId = profile?.organization_id

  const { data: instruments } = orgId
    ? await supabase
        .from('renewable_instruments')
        .select('*')
        .eq('organization_id', orgId)
        .order('year', { ascending: false })
        .order('created_at', { ascending: false })
    : { data: null }

  return (
    <>
      <Header title="Energía renovable" description="Instrumentos contractuales para Scope 2 market-based" profile={profile} />

      <div className="p-8 space-y-6 max-w-4xl">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver a Configuración
        </Link>

        {/* Nota pedagógica */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
          <h2 className="text-sm font-semibold text-blue-300 mb-1.5">
            ¿Por qué declarar instrumentos contractuales?
          </h2>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Para reportar Scope 2 con el método <strong>market-based</strong>, GHG Protocol exige
            documentar los instrumentos que demuestran consumo eléctrico contractual con fuentes
            renovables: <strong>GoOs</strong> (España/UE), <strong>RECs</strong> (US), <strong>PPAs</strong> y
            tarifas verdes con respaldo. Sin instrumentos asignados, la declaración market-based
            usa el residual mix de la región.
          </p>
        </div>

        {orgId ? (
          (instruments && instruments.length > 0) ? (
            <RenewableInstrumentsManager
              organizationId={orgId}
              instruments={instruments as RenewableInstrument[]}
            />
          ) : (
            <>
              <RenewableInstrumentsManager organizationId={orgId} instruments={[]} />
              <EmptyState
                icon={Leaf}
                title="Sin instrumentos registrados"
                description="Añade tu primer GoO, REC, PPA o tarifa verde con el formulario de arriba para empezar a soportar reporting market-based."
              />
            </>
          )
        ) : (
          <p className="text-xs text-zinc-500">Necesitas pertenecer a una organización para gestionar instrumentos.</p>
        )}
      </div>
    </>
  )
}
