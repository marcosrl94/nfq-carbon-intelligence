'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, RefreshCw, Loader2, FileText, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { purgeOrphanedEvidenceBlobs, type OrphanBlob } from '@/lib/admin/storage-actions'

interface Props {
  orphans: OrphanBlob[]
  totalAttachments: number
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function StorageManager({ orphans, totalAttachments }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const totalSize = orphans.reduce((s, o) => s + (o.size ?? 0), 0)

  function handlePurge() {
    if (orphans.length === 0) return
    if (
      !confirm(
        `¿Borrar ${orphans.length} blob${orphans.length === 1 ? '' : 's'} huérfano${
          orphans.length === 1 ? '' : 's'
        } (${fmtBytes(totalSize)})? Acción irreversible.`
      )
    )
      return
    setFeedback(null)
    startTransition(async () => {
      const result = await purgeOrphanedEvidenceBlobs()
      if (!result.ok) {
        setFeedback({
          ok: false,
          msg: `${result.error ?? 'Error desconocido'}${
            result.orphansRemoved != null ? ` (eliminados ${result.orphansRemoved} antes del fallo)` : ''
          }`,
        })
        return
      }
      setFeedback({
        ok: true,
        msg: `${result.orphansRemoved ?? 0} blob${(result.orphansRemoved ?? 0) === 1 ? '' : 's'} eliminado${
          (result.orphansRemoved ?? 0) === 1 ? '' : 's'
        }.`,
      })
    })
  }

  function handleRefresh() {
    setFeedback(null)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Attachments registrados</p>
          <p className="text-2xl font-semibold text-white tabular-nums mt-1">
            {totalAttachments.toLocaleString('es-ES')}
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5">filas en evidence_attachments</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Blobs huérfanos</p>
          <p
            className={`text-2xl font-semibold tabular-nums mt-1 ${
              orphans.length > 0 ? 'text-amber-300' : 'text-emerald-400'
            }`}
          >
            {orphans.length.toLocaleString('es-ES')}
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5">en bucket evidence sin fila asociada</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Tamaño total huérfano</p>
          <p className="text-2xl font-semibold text-white tabular-nums mt-1">
            {orphans.length > 0 ? fmtBytes(totalSize) : '—'}
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5">aprox. (metadata.size)</p>
        </div>
      </div>

      {feedback && (
        <p
          className={`text-[11px] rounded px-2.5 py-1.5 border ${
            feedback.ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {feedback.msg}
        </p>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePurge}
          disabled={pending || orphans.length === 0}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {pending
            ? 'Purgando…'
            : orphans.length === 0
              ? 'Sin huérfanos que purgar'
              : `Purgar ${orphans.length} huérfano${orphans.length === 1 ? '' : 's'}`}
        </button>
        <button
          onClick={handleRefresh}
          disabled={pending}
          className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3.5 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refrescar
        </button>
      </div>

      {/* Lista de orphans */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden">
        <div className="px-6 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Detalle de huérfanos</h2>
          {orphans.length === 0 && (
            <Badge variant="success">
              <CheckCircle2 className="h-3 w-3 mr-0.5 inline" />
              Limpio
            </Badge>
          )}
        </div>
        {orphans.length === 0 ? (
          <p className="px-6 py-8 text-center text-xs text-zinc-500">
            No hay blobs huérfanos. Tu bucket está consistente con la tabla evidence_attachments.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                <th className="px-4 py-2 text-left text-[10px] font-medium text-zinc-500">Path</th>
                <th className="px-4 py-2 text-right text-[10px] font-medium text-zinc-500">Tamaño</th>
                <th className="px-4 py-2 text-left text-[10px] font-medium text-zinc-500 w-44">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {orphans.map((o) => (
                <tr key={o.name} className="hover:bg-zinc-800/20">
                  <td className="px-4 py-1.5 text-zinc-400 font-mono text-[11px] break-all">
                    <FileText className="h-3 w-3 inline-block mr-1 text-zinc-600" />
                    {o.name}
                  </td>
                  <td className="px-4 py-1.5 text-right text-zinc-400 tabular-nums">
                    {fmtBytes(o.size ?? 0)}
                  </td>
                  <td className="px-4 py-1.5 text-zinc-500 text-[11px]">
                    {o.created_at ? new Date(o.created_at).toLocaleString('es-ES') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
