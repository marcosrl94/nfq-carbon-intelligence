'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { revalidatePath } from 'next/cache'

const FROM_EMAIL = 'NFQ Carbon Intelligence <onboarding@resend.dev>'
const ACCEPT_PATH = '/accept-invitation'

interface ActionResult {
  ok: boolean
  error?: string
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

/**
 * Envía email de invitación con Resend. Requiere RESEND_API_KEY y
 * NEXT_PUBLIC_APP_URL en el entorno. Si falta cualquiera, devuelve error
 * sin tirar la operación: la fila ya quedó persistida (el admin la puede
 * reenviar después).
 */
export async function sendInvitationEmail(invitationId: string): Promise<ActionResult> {
  const apiKey = process.env.RESEND_API_KEY
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  // Caller-context: comprobamos que el usuario es admin de la org de la invitación.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado.' }

  const { data: caller } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .maybeSingle()
  if (!caller || caller.role !== 'admin') {
    return { ok: false, error: 'Solo admins pueden enviar invitaciones.' }
  }

  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, email, token, organization_id, role, expires_at')
    .eq('id', invitationId)
    .maybeSingle()
  if (!invitation) return { ok: false, error: 'Invitación no encontrada.' }
  if (invitation.organization_id !== caller.organization_id) {
    return { ok: false, error: 'Invitación de otra organización.' }
  }

  if (!apiKey || !appUrl) {
    return { ok: false, error: 'Configuración pendiente: RESEND_API_KEY o NEXT_PUBLIC_APP_URL.' }
  }

  const acceptUrl = `${appUrl.replace(/\/$/, '')}${ACCEPT_PATH}/${invitation.token}`

  // Org name (mejor que mostrar UUID en el email)
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', invitation.organization_id)
    .maybeSingle()
  const orgName = org?.name ?? 'tu organización'

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: invitation.email,
    subject: `Invitación a ${orgName} · NFQ Carbon Intelligence`,
    html: renderEmailHtml({ orgName, role: invitation.role, acceptUrl, expiresAt: invitation.expires_at }),
  })
  if (error) {
    return { ok: false, error: `Resend falló: ${error.message ?? 'desconocido'}` }
  }
  return { ok: true }
}

/**
 * El invitee acepta la invitación: actualiza su profile (organization_id, role)
 * y marca la fila como accepted. Usa service role para tocar la fila de
 * `invitations` porque la RLS sólo permite a admin de la org leer/escribir.
 */
export async function acceptInvitation(token: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Debes iniciar sesión para aceptar la invitación.' }

  const admin = adminClient()
  if (!admin) return { ok: false, error: 'Configuración pendiente: SUPABASE_SERVICE_ROLE_KEY.' }

  const { data: invitation } = await admin
    .from('invitations')
    .select('id, email, organization_id, role, accepted, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (!invitation) return { ok: false, error: 'Token de invitación no válido.' }
  if (invitation.accepted) return { ok: false, error: 'Esta invitación ya fue aceptada.' }
  if (new Date(invitation.expires_at) < new Date()) {
    return { ok: false, error: 'Esta invitación ha caducado. Pide una nueva al admin.' }
  }
  if (user.email && invitation.email && user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return { ok: false, error: `La invitación es para ${invitation.email}, pero estás logueado como ${user.email}.` }
  }
  if (!invitation.organization_id) {
    return { ok: false, error: 'Invitación sin organización asignada.' }
  }

  // Actualizamos el profile del usuario con la org+role de la invitación
  // (vía service role para evitar problemas si el profile aún no existía).
  const { error: pErr } = await admin
    .from('profiles')
    .upsert({
      id: user.id,
      organization_id: invitation.organization_id,
      role: invitation.role,
      email: user.email ?? invitation.email,
    }, { onConflict: 'id' })
  if (pErr) return { ok: false, error: `No se pudo actualizar el perfil: ${pErr.message}` }

  const { error: iErr } = await admin
    .from('invitations')
    .update({ accepted: true })
    .eq('id', invitation.id)
  if (iErr) return { ok: false, error: `No se pudo marcar como aceptada: ${iErr.message}` }

  revalidatePath('/')
  return { ok: true }
}

function renderEmailHtml({
  orgName,
  role,
  acceptUrl,
  expiresAt,
}: {
  orgName: string
  role: string
  acceptUrl: string
  expiresAt: string
}): string {
  const expires = new Date(expiresAt).toLocaleString('es-ES')
  // Plantilla minimalista; suficiente para el flujo. Mejorar a v2.
  return `<!doctype html>
<html lang="es">
  <body style="font-family: ui-sans-serif, system-ui, sans-serif; background:#0a0a0a; color:#e4e4e7; padding:32px;">
    <div style="max-width:520px; margin:0 auto; background:#18181b; border:1px solid #27272a; border-radius:16px; padding:32px;">
      <h1 style="font-size:18px; margin:0 0 16px; color:#fff;">Te han invitado a ${escapeHtml(orgName)}</h1>
      <p style="font-size:14px; line-height:1.6; color:#d4d4d8;">
        Acabas de ser invitado a unirte como <strong>${escapeHtml(role)}</strong> en
        <strong>${escapeHtml(orgName)}</strong> en NFQ Carbon Intelligence Platform.
      </p>
      <p style="margin:24px 0;">
        <a href="${acceptUrl}" style="display:inline-block; background:#10b981; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600;">Aceptar invitación</a>
      </p>
      <p style="font-size:12px; color:#71717a; line-height:1.6;">
        Caduca el ${escapeHtml(expires)}. Si no esperabas esta invitación, ignora este email.<br/>
        Enlace: <a href="${acceptUrl}" style="color:#10b981;">${acceptUrl}</a>
      </p>
    </div>
  </body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      default: return '&#39;'
    }
  })
}
