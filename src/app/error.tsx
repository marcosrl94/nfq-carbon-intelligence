'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app/error]', error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center">
      <h1 className="text-lg font-semibold text-white">Algo salió mal</h1>
      <p className="text-sm text-zinc-400 max-w-md">
        {error.message || 'Error inesperado al renderizar la página.'}
      </p>
      {error.digest && (
        <p className="text-xs text-zinc-600 font-mono">digest: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
      >
        Reintentar
      </button>
    </div>
  )
}
