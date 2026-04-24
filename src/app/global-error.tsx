'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center text-zinc-100 antialiased">
        <h1 className="text-lg font-semibold">Error crítico</h1>
        <p className="text-sm text-zinc-400 max-w-md">
          {error.message || 'No se pudo cargar la aplicación.'}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Reintentar
        </button>
      </body>
    </html>
  )
}
