import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/ui/header'
import { EmptyState } from '@/components/ui/empty-state'
import { Compass } from 'lucide-react'
import { MaterialityManager } from './materiality-manager'
import type {
  IndustryMateriality,
  NaceSector,
  Organization,
  OrgMaterialityOverride,
} from '@/types/database'

export default async function MaterialityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const orgId = profile?.organization_id

  const { data: organization } = orgId
    ? await supabase.from('organizations').select('*').eq('id', orgId).maybeSingle()
    : { data: null }

  // Catálogo NACE + materialidad (read-only)
  const [{ data: sectors }, { data: catalog }, { data: overrides }] = await Promise.all([
    supabase.from('nace_sectors').select('*').order('code', { ascending: true }),
    supabase.from('industry_materiality').select('*'),
    orgId
      ? supabase.from('org_materiality_overrides').select('*').eq('organization_id', orgId)
      : Promise.resolve({ data: [] as OrgMaterialityOverride[] }),
  ])

  // Entries del último inventario (con embed factor.s3_category para hotspot granular)
  const { data: inventories } = orgId
    ? await supabase
        .from('ghg_inventories')
        .select('id, fiscal_year, emission_entries(scope, category, tco2e, emission_factors(s3_category))')
        .eq('organization_id', orgId)
        .order('fiscal_year', { ascending: false })
        .limit(1)
    : { data: null }

  const latestInventory = inventories?.[0]

  return (
    <>
      <Header title="Materialidad sectorial" description="Hotspots esperados según el sector de la organización (NACE + ESRS)" profile={profile} />

      <div className="p-8 space-y-6 max-w-7xl">
        {/* Nota pedagógica */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
          <h2 className="text-sm font-semibold text-blue-300 mb-1.5">
            Qué es esta matriz
          </h2>
          <p className="text-xs text-zinc-300 leading-relaxed">
            <strong>CSRD/ESRS</strong> exige doble materialidad: una organización debe declarar
            qué temas son materiales para su sector. Esta matriz cruza tu(s) sector(es){' '}
            <strong>NACE Rev 2.1</strong> con <strong>scopes/categorías GHG Protocol</strong> y
            muestra el nivel de materialidad esperada (0–3) según EFRAG ESRS sector standards y
            SASB Materiality Map. Sirve para priorizar dónde buscar datos.
          </p>
          <p className="text-xs text-zinc-300 leading-relaxed mt-2">
            Si tu organización tiene un perfil atípico (ej. retail con flota propia muy alta),
            puedes <strong>sobrescribir</strong> el valor con justificación. El override queda
            auditado.
          </p>
        </div>

        {orgId && organization ? (
          <MaterialityManager
            organization={organization as Organization}
            sectors={(sectors ?? []) as NaceSector[]}
            catalog={(catalog ?? []) as IndustryMateriality[]}
            overrides={(overrides ?? []) as OrgMaterialityOverride[]}
            latestInventoryEntries={
              // Supabase devuelve emission_factors como array; el helper detectHotspots
              // acepta ambos formatos.
              (latestInventory?.emission_entries ?? []) as {
                scope: string | null
                category: string | null
                tco2e: number | null
                emission_factors?: { s3_category: number | null }[] | null
              }[]
            }
            latestInventoryYear={latestInventory?.fiscal_year ?? null}
            isAdmin={profile?.role === 'admin'}
          />
        ) : (
          <EmptyState
            icon={Compass}
            title="Organización no configurada"
            description="Necesitas una organización asignada para ver tu matriz de materialidad."
          />
        )}
      </div>
    </>
  )
}
