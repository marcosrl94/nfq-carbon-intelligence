import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/ui/header'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Factory } from 'lucide-react'
import { NewInventoryButton } from './new-inventory-button'
import { InventoryDetail } from './inventory-detail'
import type { InventoryStatus } from '@/types/database'

const statusBadge: Record<InventoryStatus, { label: string; variant: 'success' | 'warning' | 'default' }> = {
  draft: { label: 'Borrador', variant: 'default' },
  submitted: { label: 'Enviado', variant: 'warning' },
  verified: { label: 'Verificado', variant: 'success' },
}

export default async function EmissionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id ?? '').single()

  const orgId = profile?.organization_id

  const { data: inventories } = await supabase
    .from('ghg_inventories')
    .select('*, emission_entries(*)')
    .eq('organization_id', orgId ?? '')
    .order('fiscal_year', { ascending: false })

  return (
    <>
      <Header title="Emisiones GEI" description="Gestión de inventarios y entradas de emisiones" profile={profile}>
        {orgId && <NewInventoryButton organizationId={orgId} />}
      </Header>

      <div className="p-8">
        {(!inventories || inventories.length === 0) ? (
          <EmptyState
            icon={Factory}
            title="Sin inventarios"
            description="Crea tu primer inventario de emisiones GEI para comenzar a registrar la huella de carbono de tu organización."
          />
        ) : (
          <div className="space-y-6">
            {inventories.map((inv) => {
              const badge = statusBadge[inv.status as InventoryStatus]
              const total = inv.emission_entries.reduce((s: number, e: { tco2e: number | null }) => s + (e.tco2e ?? 0), 0)
              return (
                <div key={inv.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
                        <span className="text-sm font-mono font-medium text-zinc-300">{inv.fiscal_year}</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Inventario {inv.fiscal_year}</h3>
                        <p className="text-xs text-zinc-500">
                          {inv.emission_entries.length} entradas · Total: {total > 0 ? `${total.toLocaleString('es-ES')} tCO₂e` : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                  </div>
                  <InventoryDetail inventory={inv} entries={inv.emission_entries} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
