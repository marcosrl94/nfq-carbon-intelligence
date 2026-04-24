'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types/database'

interface Props {
  profile: Profile | null
  authEmail: string | null
}

export function ProfileForm({ profile, authEmail }: Props) {
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSave() {
    if (!profile) {
      setError('No hay fila de perfil en la base de datos. Recarga la página; si persiste, revisa Supabase (perfiles RLS) o los logs de ensureUserProfile.')
      return
    }
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error: pErr } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() || null })
      .eq('id', profile.id)

    if (pErr) {
      setError(
        pErr.message +
          (pErr.code ? ` (código: ${pErr.code})` : '') +
          ' — comprobá políticas RLS en public.profiles y que tu usuario sea el dueño (id = auth.uid()).'
      )
      setLoading(false)
      return
    }

    const { error: aErr } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim() || null },
    })
    if (aErr) {
      setError('Perfil guardado en `profiles`, pero no se pudo actualizar la metadata de Auth: ' + aErr.message)
    } else {
      setMessage('Nombre guardado.')
    }
    setLoading(false)
    router.refresh()
    setTimeout(() => setMessage(null), 3000)
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        Aún no tienes fila en <code className="text-amber-100">public.profiles</code>. Entra otra vez al
        dashboard o revisa en Supabase que el alta de org/perfil haya ido bien (mira la consola del servidor
        por <code>ensureUserProfile</code>).
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50">
      <div className="px-6 py-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white">Tu perfil</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Nombre e email de la cuenta</p>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Email (desde la sesión)</label>
          <input
            readOnly
            value={authEmail ?? profile.email ?? '—'}
            className="w-full rounded-lg border border-zinc-700/80 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-400"
          />
          <p className="text-[11px] text-zinc-500 mt-1">
            Para cambiar el email, usa el panel de Supabase (Authentication) o el flujo de cambio de email de
            tu proveedor; aquí no se modifica <code>auth.users</code>.
          </p>
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Nombre completo</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="Tu nombre"
          />
        </div>
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 whitespace-pre-wrap">
            {error}
          </div>
        )}
        {message && <p className="text-xs text-emerald-400">{message}</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar perfil'}
        </button>
      </div>
    </div>
  )
}
