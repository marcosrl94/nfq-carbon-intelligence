'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const demoErrors: Record<string, string> = {
  auth: 'No se pudo completar el inicio de sesión. Vuelve a intentarlo.',
  demo_unconfigured:
    'Cuenta demo no configurada (DEMO_USER_EMAIL y DEMO_USER_PASSWORD en el servidor).',
  demo_signin:
    'No se pudo entrar con la demo. Revisa el usuario en Supabase Auth y la contraseña en .env.',
}

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const errParam = searchParams.get('error')
  const urlError = errParam ? (demoErrors[errParam] ?? null) : null
  const displayError = error ?? urlError

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
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
          <p className="text-zinc-400 text-sm">Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {displayError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
              {displayError}
            </div>
          )}

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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Entrando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-400">
          ¿No tienes cuenta?{' '}
          <Link href="/signup" className="text-emerald-400 hover:text-emerald-300">
            Regístrate
          </Link>
        </p>

        <form action="/api/auth/demo" method="post" className="pt-2">
          <button
            type="submit"
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800/50 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Entrar con cuenta demo
          </button>
        </form>
      </div>
    </div>
  )
}
