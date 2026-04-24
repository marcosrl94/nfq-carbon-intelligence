'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Botón de "Continuar con Google" (OAuth).
 *
 * Flujo:
 * 1. Usuario pulsa → `supabase.auth.signInWithOAuth({ provider: 'google' })`
 * 2. Supabase redirige a Google → consent → Google redirige a `https://<ref>.supabase.co/auth/v1/callback`
 * 3. Supabase redirige a nuestro `redirectTo` (/callback) con `?code=...`
 * 4. `src/app/(auth)/callback/route.ts` hace `exchangeCodeForSession(code)` y manda a `/`
 * 5. El layout del dashboard ejecuta `ensureUserProfile()` que crea org + profile en el primer acceso
 *
 * Requiere:
 * - Supabase → Authentication → Providers → Google habilitado con Client ID/Secret.
 * - En Google Cloud Console → OAuth client → Authorized redirect URI:
 *   `https://<tu-ref>.supabase.co/auth/v1/callback`
 */
export function GoogleSignInButton({ label }: { label?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleClick() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/callback`,
        queryParams: {
          // Pide explícitamente email + profile por si el consent screen no los lleva por defecto
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // Si no hay error, el navegador redirige a Google — no hace falta limpiar loading
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-600 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 transition-colors"
      >
        <GoogleIcon />
        <span>{loading ? 'Redirigiendo…' : (label ?? 'Continuar con Google')}</span>
      </button>
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  )
}
