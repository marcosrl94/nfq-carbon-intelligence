import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Leaf, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { acceptInvitation } from '@/lib/invitations/actions'

interface PageProps {
  params: Promise<{ token: string }>
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

export default async function AcceptInvitationPage({ params }: PageProps) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Lookup vía service role (RLS de invitations es admin-only en T10)
  const admin = adminClient()
  let invitationInfo: {
    email: string
    role: string
    accepted: boolean
    expires_at: string
    org_name: string | null
  } | null = null

  if (admin) {
    const { data: inv } = await admin
      .from('invitations')
      .select('email, role, accepted, expires_at, organization_id')
      .eq('token', token)
      .maybeSingle()

    if (inv) {
      const { data: org } = await admin
        .from('organizations')
        .select('name')
        .eq('id', inv.organization_id ?? '')
        .maybeSingle()
      invitationInfo = {
        email: inv.email,
        role: inv.role,
        accepted: inv.accepted,
        expires_at: inv.expires_at,
        org_name: org?.name ?? null,
      }
    }
  }

  if (!invitationInfo) {
    return <Shell title="Invitación no válida" subtitle="El token no existe o ha sido revocado." />
  }

  if (invitationInfo.accepted) {
    return <Shell title="Ya aceptada" subtitle={`Esta invitación a ${invitationInfo.org_name ?? 'la organización'} ya fue aceptada anteriormente.`} />
  }

  const expired = new Date(invitationInfo.expires_at) < new Date()
  if (expired) {
    return <Shell title="Invitación caducada" subtitle="Pide al admin que te envíe una nueva." />
  }

  // Si no hay sesión, mandamos a login y volvemos aquí.
  if (!user) {
    const returnTo = encodeURIComponent(`/accept-invitation/${token}`)
    return (
      <Shell
        title={`Te han invitado a ${invitationInfo.org_name ?? 'una organización'}`}
        subtitle={`Inicia sesión como ${invitationInfo.email} para aceptar la invitación.`}
      >
        <Link
          href={`/login?next=${returnTo}`}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          Iniciar sesión y aceptar
        </Link>
      </Shell>
    )
  }

  if (user.email && user.email.toLowerCase() !== invitationInfo.email.toLowerCase()) {
    return (
      <Shell
        title="Email no coincide"
        subtitle={`La invitación es para ${invitationInfo.email}, pero estás logueado como ${user.email}. Cierra sesión y entra con la cuenta correcta.`}
      />
    )
  }

  // Acción del botón "Aceptar" → server action.
  async function accept(): Promise<void> {
    'use server'
    const result = await acceptInvitation(token)
    if (!result.ok) {
      // Volveremos a esta página con el error en query.
      redirect(`/accept-invitation/${token}?error=${encodeURIComponent(result.error ?? 'Error desconocido')}`)
    }
    redirect('/')
  }

  return (
    <Shell
      title={`Te han invitado a ${invitationInfo.org_name ?? 'una organización'}`}
      subtitle={`Rol propuesto: ${invitationInfo.role}. Al aceptar, tu cuenta se asociará a esta organización.`}
    >
      <form action={accept}>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          <CheckCircle2 className="h-4 w-4" />
          Aceptar invitación
        </button>
      </form>
    </Shell>
  )
}

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children?: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-8">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8 space-y-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
            <Leaf className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">NFQ Carbon Intelligence</span>
        </div>
        <h1 className="text-lg font-semibold text-white leading-tight">{title}</h1>
        <p className="text-sm text-zinc-300 leading-relaxed">{subtitle}</p>
        {children}
      </div>
    </div>
  )
}
