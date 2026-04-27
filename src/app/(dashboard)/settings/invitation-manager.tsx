'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Mail, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { sendInvitationEmail } from '@/lib/invitations/actions'
import type { Invitation, UserRole } from '@/types/database'

interface Props {
  organizationId: string
  invitations: Invitation[]
}

const INVITATION_TTL_DAYS = 7

export function InvitationManager({ organizationId, invitations }: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('analyst')
  const [loading, setLoading] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleInvite() {
    setLoading(true)
    setFeedback(null)
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000).toISOString()
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        organization_id: organizationId,
        email,
        role,
        token: crypto.randomUUID(),
        expires_at: expiresAt,
      })
      .select('id')
      .single()

    if (error || !data) {
      setFeedback({ ok: false, msg: error?.message ?? 'No se pudo crear la invitación.' })
      setLoading(false)
      return
    }

    // Lanzamos el envío del email (server action). Si falla, dejamos la fila
    // creada y mostramos el motivo: el admin puede reenviar después.
    const result = await sendInvitationEmail(data.id)
    if (result.ok) {
      setFeedback({ ok: true, msg: `Invitación enviada a ${email}.` })
    } else {
      setFeedback({ ok: false, msg: `Invitación creada pero email NO enviado: ${result.error}` })
    }

    setEmail('')
    setLoading(false)
    router.refresh()
  }

  async function handleResend(id: string, email: string) {
    setResendingId(id)
    setFeedback(null)
    const result = await sendInvitationEmail(id)
    setResendingId(null)
    setFeedback(
      result.ok
        ? { ok: true, msg: `Reenviado a ${email}.` }
        : { ok: false, msg: result.error ?? 'Reenvío falló.' }
    )
  }

  async function handleDelete(id: string) {
    await supabase.from('invitations').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50">
      <div className="px-6 py-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white">Invitaciones</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Invita a miembros de tu equipo</p>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex gap-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="email@empresa.com"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          >
            <option value="admin">Admin</option>
            <option value="analyst">Analista</option>
            <option value="client">Cliente</option>
            <option value="auditor">Auditor</option>
          </select>
          <button
            onClick={handleInvite}
            disabled={loading || !email}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Invitar
          </button>
        </div>

        {feedback && (
          <p
            className={`text-[11px] rounded px-2 py-1.5 border ${
              feedback.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            {feedback.msg}
          </p>
        )}

        {invitations.length > 0 && (
          <div className="divide-y divide-zinc-800/50 rounded-lg border border-zinc-800/50">
            {invitations.map(inv => {
              const expired = !inv.accepted && new Date(inv.expires_at) < new Date()
              return (
                <div key={inv.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-sm text-zinc-300">{inv.email}</p>
                    <p className="text-xs text-zinc-500 capitalize">
                      {inv.role}
                      {!inv.accepted && (
                        <span className="text-zinc-600">
                          {' · caduca '}
                          {new Date(inv.expires_at).toLocaleDateString('es-ES')}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={inv.accepted ? 'success' : expired ? 'danger' : 'default'}>
                      {inv.accepted ? 'Aceptada' : expired ? 'Caducada' : 'Pendiente'}
                    </Badge>
                    {!inv.accepted && !expired && (
                      <button
                        onClick={() => handleResend(inv.id, inv.email)}
                        disabled={resendingId === inv.id}
                        className="text-zinc-500 hover:text-emerald-400 transition-colors disabled:opacity-40"
                        title="Reenviar email"
                      >
                        {resendingId === inv.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Mail className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    <button onClick={() => handleDelete(inv.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
