import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

/**
 * Supabase-js devuelve PostgrestError con { message, code, details, hint }, pero
 * al loguear con console.error(label, err) sale "{}" porque no son propiedades enumerables
 * estándar. Esta función extrae lo útil para que el log real aparezca en el servidor.
 */
function formatSbError(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== 'object') return { raw: String(err) }
  const e = err as Record<string, unknown>
  return {
    message: e.message,
    code: e.code,
    details: e.details,
    hint: e.hint,
    name: e.name,
  }
}

/**
 * Crea org + fila de perfil al primer acceso.
 * Por defecto usa la sesión del usuario y las políticas RLS
 * `org_insert_first` + `profiles_insert_self` (20250423140000_rls_and_audit_triggers.sql).
 * Si falla, reintenta con service role (opcional) para despliegues sin esas políticas o triggers legacy.
 */
export async function ensureUserProfile(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()
  if (existing) return

  const fiscalYear = new Date().getFullYear()
  const row = {
    name: 'Mi organización' as const,
    sectors: [] as string[],
    geographies: [] as string[],
    consolidation: 'operational' as const,
    fiscal_year: fiscalYear,
    employees: null as null,
    revenue_eur_m: null as null,
    /** RLS org_select: permite leer la fila tras INSERT antes de existir profiles (ver 20250424120000). */
    created_by_user_id: user.id,
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert(row)
    .select('id')
    .single()

  if (!orgError && org) {
    const { error: pError } = await supabase.from('profiles').insert({
      id: user.id,
      organization_id: org.id,
      role: 'admin',
      full_name:
        (user.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name?.trim() ||
        (user.user_metadata as { full_name?: string; name?: string } | undefined)?.name?.trim() ||
        null,
      email: user.email ?? null,
    })
    if (!pError) return
    console.error('[ensureUserProfile] profiles (sesión RLS)', formatSbError(pError))

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && key) {
      await insertProfileWithServiceRole(user, org.id, url, key)
    }
    return
  }

  console.error('[ensureUserProfile] organizations (sesión RLS)', formatSbError(orgError))

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return
  }

  await ensureOrgAndProfileWithServiceRole(user, url, key, row)
}

/** Solo inserta el perfil (la org ya existe vía RLS). */
async function insertProfileWithServiceRole(
  user: User,
  organizationId: string,
  url: string,
  key: string
): Promise<void> {
  const admin = createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })

  const { error: pError } = await admin.from('profiles').insert({
    id: user.id,
    organization_id: organizationId,
    role: 'admin',
    full_name:
      (user.user_metadata as { full_name?: string } | undefined)?.full_name?.trim() || null,
    email: user.email ?? null,
  })

  if (pError) {
    console.error('[ensureUserProfile] profiles (service role, solo perfil)', formatSbError(pError))
  }
}

async function ensureOrgAndProfileWithServiceRole(
  user: User,
  url: string,
  key: string,
  row: {
    name: 'Mi organización'
    sectors: string[]
    geographies: string[]
    consolidation: 'operational'
    fiscal_year: number
    employees: null
    revenue_eur_m: null
    created_by_user_id: string
  }
): Promise<void> {
  const admin = createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })

  const { data: again } = await admin.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (again) return

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert(row)
    .select('id')
    .single()

  if (orgError || !org) {
    console.error('[ensureUserProfile] organizations (service role)', formatSbError(orgError))
    return
  }

  const { error: pError } = await admin.from('profiles').insert({
    id: user.id,
    organization_id: org.id,
    role: 'admin',
    full_name:
      (user.user_metadata as { full_name?: string } | undefined)?.full_name?.trim() || null,
    email: user.email ?? null,
  })

  if (pError) {
    console.error('[ensureUserProfile] profiles (service role)', formatSbError(pError))
    await admin.from('organizations').delete().eq('id', org.id)
  }
}
