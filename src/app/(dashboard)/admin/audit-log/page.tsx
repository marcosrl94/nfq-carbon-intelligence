import Link from 'next/link'
import { ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/ui/header'
import { Badge } from '@/components/ui/badge'
import type { Profile } from '@/types/database'

const PAGE_SIZE = 50

interface SearchParams {
  action?: string
  user?: string
  since?: string
  until?: string
  page?: string
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  // Guard admin-only en server (la sidebar ya filtra el link, pero defensa en profundidad)
  if (profile?.role !== 'admin') {
    return (
      <>
        <Header title="Audit log" description="Acceso restringido" profile={profile} />
        <div className="p-8">
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 max-w-xl">
            <h2 className="text-sm font-semibold text-red-300 mb-1.5">Forbidden</h2>
            <p className="text-xs text-zinc-300">
              El registro de auditoría sólo es accesible para administradores. Tu rol actual es{' '}
              <code className="text-zinc-200">{profile?.role ?? 'sin asignar'}</code>.
            </p>
          </div>
        </div>
      </>
    )
  }

  const orgId = profile.organization_id
  const page = Math.max(1, Number(params.page ?? '1') || 1)
  const offset = (page - 1) * PAGE_SIZE

  // Query con filtros (RLS ya restringe a la org, no hace falta repetir el predicate)
  let q = supabase
    .from('audit_log_entries')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (params.action && params.action.trim()) q = q.ilike('action', `%${params.action.trim()}%`)
  if (params.user && params.user.trim()) q = q.eq('user_id', params.user.trim())
  if (params.since) q = q.gte('created_at', params.since)
  if (params.until) q = q.lte('created_at', params.until)

  const { data: entries, count } = await q

  // Profiles del org → mapeo user_id → full_name/email para la UI
  const { data: members } = orgId
    ? await supabase.from('profiles').select('id, full_name, email').eq('organization_id', orgId)
    : { data: null }
  const memberById = new Map<string, Pick<Profile, 'id' | 'full_name' | 'email'>>(
    (members ?? []).map((m) => [m.id, m as Pick<Profile, 'id' | 'full_name' | 'email'>])
  )

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1
  const hasPrev = page > 1
  const hasNext = page < totalPages

  // Serializa los params actuales para preservarlos en la paginación
  function pageHref(p: number): string {
    const sp = new URLSearchParams()
    if (params.action) sp.set('action', params.action)
    if (params.user) sp.set('user', params.user)
    if (params.since) sp.set('since', params.since)
    if (params.until) sp.set('until', params.until)
    sp.set('page', String(p))
    return `/admin/audit-log?${sp.toString()}`
  }

  return (
    <>
      <Header title="Audit log" description="Registro inmutable de cambios en la organización" profile={profile} />

      <div className="p-8 space-y-4 max-w-6xl">
        {/* Filtros */}
        <form action="/admin/audit-log" method="get" className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className="block text-[11px] text-zinc-400 mb-1">Action contiene</label>
            <input
              name="action"
              defaultValue={params.action ?? ''}
              placeholder="ej. emission_entries.insert"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">Usuario</label>
            <select
              name="user"
              defaultValue={params.user ?? ''}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Todos</option>
              {(members ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name ?? m.email ?? m.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">Desde</label>
            <input
              name="since"
              type="date"
              defaultValue={params.since ?? ''}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">Hasta</label>
            <input
              name="until"
              type="date"
              defaultValue={params.until ?? ''}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="col-span-2 md:col-span-5 flex justify-between items-center">
            <p className="text-[11px] text-zinc-500">
              {count != null ? `${count.toLocaleString('es-ES')} entradas · página ${page} de ${totalPages}` : '—'}
            </p>
            <div className="flex gap-2">
              <Link
                href="/admin/audit-log"
                className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                Limpiar
              </Link>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Filtrar
              </button>
            </div>
          </div>
        </form>

        {/* Tabla */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                <th className="px-4 py-2 text-left text-[10px] font-medium text-zinc-500 w-44">Timestamp</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium text-zinc-500 w-44">Usuario</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium text-zinc-500 w-56">Action</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium text-zinc-500">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {(entries ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-zinc-500">
                    Sin entradas con esos filtros.
                  </td>
                </tr>
              ) : (
                (entries ?? []).map((e) => {
                  const member = e.user_id ? memberById.get(e.user_id) : null
                  const action = e.action as string
                  const variant: 'success' | 'warning' | 'danger' | 'info' | 'default' = action.endsWith('.insert')
                    ? 'success'
                    : action.endsWith('.update')
                      ? 'info'
                      : action.endsWith('.delete')
                        ? 'danger'
                        : 'default'
                  const payloadText = JSON.stringify(e.payload, null, 2)
                  const truncated = payloadText.length > 120 ? payloadText.slice(0, 120) + '…' : payloadText
                  return (
                    <tr key={e.id} className="hover:bg-zinc-800/20 align-top">
                      <td className="px-4 py-2 text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(e.created_at).toLocaleString('es-ES')}
                      </td>
                      <td className="px-4 py-2 text-zinc-300">
                        {member ? (
                          <span title={e.user_id ?? ''}>{member.full_name ?? member.email}</span>
                        ) : (
                          <span className="text-zinc-500 font-mono">{e.user_id?.slice(0, 8) ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={variant}>{action}</Badge>
                      </td>
                      <td className="px-4 py-2 text-zinc-400">
                        <details>
                          <summary className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors font-mono">
                            {truncated}
                          </summary>
                          <pre className="mt-2 rounded bg-zinc-900 border border-zinc-800 p-2 text-[10px] text-zinc-300 overflow-x-auto max-h-64">
                            {payloadText}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <Link
              href={hasPrev ? pageHref(page - 1) : '#'}
              className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 transition-colors ${
                hasPrev ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-zinc-800/40 text-zinc-600 pointer-events-none'
              }`}
              aria-disabled={!hasPrev}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </Link>
            <span className="text-zinc-500">
              Página {page} de {totalPages}
            </span>
            <Link
              href={hasNext ? pageHref(page + 1) : '#'}
              className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 transition-colors ${
                hasNext ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-zinc-800/40 text-zinc-600 pointer-events-none'
              }`}
              aria-disabled={!hasNext}
            >
              Siguiente
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
