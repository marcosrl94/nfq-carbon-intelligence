import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Crea org + fila de perfil al primer acceso, alineada con
 * `settings/organization-form` (el trigger SQL podía chocar con el esquema real).
 * Usa el service role para no depender de políticas RLS en el primer alta.
 *
 * Mismas columnas mínimas que `20250422120000_onboarding_and_demo.sql` (handle_new_user).
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error(
      '[ensureUserProfile] Necesitas SUPABASE_SERVICE_ROLE_KEY en .env para crear el perfil al registrarte'
    )
    return
  }

  const admin = createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })

  const fiscalYear = new Date().getFullYear()
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      name: 'Mi organización',
      sectors: [],
      geographies: [],
      consolidation: 'operational',
      fiscal_year: fiscalYear,
      employees: null,
      revenue_eur_m: null,
    })
    .select('id')
    .single()

  if (orgError || !org) {
    console.error('[ensureUserProfile] organizations', orgError)
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
    console.error('[ensureUserProfile] profiles', pError)
    await admin.from('organizations').delete().eq('id', org.id)
  }
}
