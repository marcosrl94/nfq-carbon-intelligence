import Link from 'next/link'
import { ChevronRight, Leaf } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/ui/header'
import { OrganizationForm } from './organization-form'
import { InvitationManager } from './invitation-manager'
import { ProfileForm } from './profile-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .maybeSingle()
  const orgId = profile?.organization_id

  const { data: organization } = orgId
    ? await supabase.from('organizations').select('*').eq('id', orgId).maybeSingle()
    : { data: null }

  const { data: members } = orgId
    ? await supabase.from('profiles').select('*').eq('organization_id', orgId)
    : { data: null }

  const { data: invitations } = orgId
    ? await supabase.from('invitations').select('*').eq('organization_id', orgId).order('created_at', { ascending: false })
    : { data: null }

  return (
    <>
      <Header title="Configuración" description="Gestión de organización, equipo e integraciones" profile={profile} />

      <div className="p-8 space-y-8 max-w-3xl">
        <ProfileForm profile={profile} authEmail={user?.email ?? null} />

        {/* Organization */}
        <OrganizationForm organization={organization} profile={profile} />

        {/* Sub-secciones */}
        <Link
          href="/settings/renewable-energy"
          className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/50 px-6 py-4 hover:bg-zinc-900/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600/15">
              <Leaf className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Energía renovable</p>
              <p className="text-xs text-zinc-500">Instrumentos contractuales (GoO/REC/PPA) para Scope 2 market-based</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-500" />
        </Link>

        {/* Team members */}
        {members && members.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">Equipo</h2>
              <p className="text-xs text-zinc-500 mt-0.5">{members.length} miembros</p>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                      <span className="text-xs font-medium text-zinc-400">
                        {m.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-200">{m.full_name ?? 'Sin nombre'}</p>
                      <p className="text-xs text-zinc-500">{m.email}</p>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500 capitalize">{m.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invitations */}
        {orgId && profile?.role === 'admin' && (
          <InvitationManager organizationId={orgId} invitations={invitations ?? []} />
        )}
      </div>
    </>
  )
}
