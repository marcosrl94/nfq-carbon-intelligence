import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/ui/header'
import { listEmissionFactors } from '@/lib/emissions/factors'
import { ImportWizard } from './import-wizard'
import type { GHGInventory } from '@/types/database'

export default async function ImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const orgId = profile?.organization_id

  const { data: inventories } = orgId
    ? await supabase
        .from('ghg_inventories')
        .select('id, organization_id, fiscal_year, ef_source, status, submitted_at, verified_at, created_at, updated_at')
        .eq('organization_id', orgId)
        .order('fiscal_year', { ascending: false })
    : { data: null }

  const factors = await listEmissionFactors()

  return (
    <>
      <Header title="Importar emisiones" description="Carga masiva de entradas vía CSV" profile={profile} />

      <div className="p-8 space-y-6 max-w-5xl">
        <Link
          href="/emissions"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver a Emisiones
        </Link>

        {orgId ? (
          <ImportWizard
            inventories={(inventories ?? []) as GHGInventory[]}
            factors={factors}
          />
        ) : (
          <p className="text-sm text-zinc-400">Necesitas pertenecer a una organización para importar.</p>
        )}
      </div>
    </>
  )
}
