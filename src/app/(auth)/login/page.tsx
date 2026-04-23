import { Suspense } from 'react'
import { LoginForm } from './login-form'

function LoginFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <p className="text-sm text-zinc-500">Cargando…</p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  )
}
