'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'

/**
 * "Database error finding user" (y similares) es un mensaje genérico de Supabase: a veces es un
 * trigger en auth.users, otras veces otra consulta/RLS. No implica siempre `handle_new_user`.
 */
function mapSignupError(message: string): string {
  if (
    /database error (finding|checking) (user|email)/i.test(message) ||
    /database error saving/i.test(message)
  ) {
    return [
      'El registro no pudo completarse: Postgres devolvió un error y Auth muestra un mensaje genérico; no siempre es el mismo fallo.',
      '',
      '1) Si aún no lo hiciste: en Supabase → SQL → New query, ejecuta el SQL de `supabase/migrations/20250422130000_drop_handle_new_user_trigger.sql` (quita el trigger/función handle_new_user). O en la raíz: `npm run db:drop-auth-trigger` (con .env.local y conexión a la base).',
      '',
      '2) Si ya lo aplicaste y sigue igual: revisa Supabase → Logs → Postgres, y comprobaciones en Auth (email duplicado, registro deshabilitado, plantillas de email). Puede ser RLS, otro trigger o una política distinta a handle_new_user.',
    ].join('\n')
  }
  if (/user already registered|already been registered|already exists/i.test(message)) {
    return 'Ese email ya está registrado. Prueba a iniciar sesión o a recuperar la contraseña en Supabase Auth.'
  }
  return message
}

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    })

    if (error) {
      setError(mapSignupError(error.message))
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Registro sin usuario en la respuesta. Revisa la consola o la configuración de Supabase (signup habilitado, proveedor email).')
      setLoading(false)
      return
    }

    // Si "Confirmar email" está desactivado en Supabase, la sesión viene al instante
    if (data.session) {
      setLoading(false)
      router.push('/')
      router.refresh()
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-emerald-600/20 flex items-center justify-center mx-auto">
            <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">Revisa tu email</h2>
          <p className="text-sm text-zinc-400">
            Hemos enviado un enlace de confirmación a <strong className="text-zinc-300">{email}</strong>
          </p>
          <Link href="/login" className="text-sm text-emerald-400 hover:text-emerald-300">
            Volver al login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">CI</span>
            </div>
            <h1 className="text-xl font-semibold text-white">Carbon Intelligence</h1>
          </div>
          <p className="text-zinc-400 text-sm">Crea tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400 whitespace-pre-line text-left"
              role="alert"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Nombre completo
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="María García"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="tu@empresa.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-zinc-950 px-2 text-zinc-500">o regístrate con</span>
          </div>
        </div>

        <GoogleSignInButton label="Registrarse con Google" />

        <p className="text-center text-sm text-zinc-400">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-emerald-400 hover:text-emerald-300">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
