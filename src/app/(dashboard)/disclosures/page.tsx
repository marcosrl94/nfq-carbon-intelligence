import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/ui/header'
import { EmptyState } from '@/components/ui/empty-state'
import { FileText } from 'lucide-react'
import { DisclosureManager } from './disclosure-manager'

export default async function DisclosuresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .maybeSingle()
  const orgId = profile?.organization_id

  const { data: inventories } = await supabase
    .from('ghg_inventories')
    .select('id, fiscal_year, status')
    .eq('organization_id', orgId ?? '')
    .order('fiscal_year', { ascending: false })

  const { data: disclosures } = await supabase
    .from('regulatory_disclosures')
    .select('*')
    .in('inventory_id', inventories?.map(i => i.id) ?? [])
    .order('created_at', { ascending: false })

  return (
    <>
      <Header title="Disclosures regulatorios" description="Gestión de divulgaciones TCFD, ESRS y otros frameworks" profile={profile} />

      <div className="p-8">
        {(!inventories || inventories.length === 0) ? (
          <EmptyState
            icon={FileText}
            title="Sin inventarios disponibles"
            description="Necesitas crear al menos un inventario GEI antes de generar disclosures regulatorios."
          />
        ) : (
          <DisclosureManager inventories={inventories} disclosures={disclosures ?? []} />
        )}
      </div>
    </>
  )
}
