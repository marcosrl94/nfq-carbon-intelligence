'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Trash2, Upload, X, FileText, Download, Loader2 } from 'lucide-react'
import type { EmissionEntry, EvidenceAttachment } from '@/types/database'

interface Props {
  entry: EmissionEntry
  attachments: EvidenceAttachment[]
  organizationId: string
  onClose: () => void
}

const SIGNED_URL_TTL_SECONDS = 60

function fmtBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Sanea un nombre de fichero para su uso como path en Storage.
 * Quita acentos, sustituye whitespace por '_', conserva extensión.
 */
function safeFilename(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
}

export function AttachmentsDrawer({ entry, attachments, organizationId, onClose }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [uploading, setUploading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [description, setDescription] = useState('')

  async function handleUpload(file: File) {
    setError(null)
    setUploading(true)

    const cleanName = safeFilename(file.name) || 'archivo'
    // Path enforcement (storage RLS): {org_id}/{entry_id}/{timestamp}-{name}
    const stamp = Date.now()
    const storagePath = `${organizationId}/${entry.id}/${stamp}-${cleanName}`

    const upload = await supabase.storage
      .from('evidence')
      .upload(storagePath, file, { contentType: file.type || undefined, upsert: false })

    if (upload.error) {
      setError(`Subida falló: ${upload.error.message}`)
      setUploading(false)
      return
    }

    const insert = await supabase.from('evidence_attachments').insert({
      entry_id: entry.id,
      filename: file.name,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      storage_path: storagePath,
      description: description.trim() || null,
    })

    if (insert.error) {
      // Limpieza: si la fila no se pudo crear, intentamos no dejar el blob huérfano
      await supabase.storage.from('evidence').remove([storagePath])
      setError(`Registro falló: ${insert.error.message}`)
      setUploading(false)
      return
    }

    setDescription('')
    setUploading(false)
    router.refresh()
  }

  async function handleDownload(att: EvidenceAttachment) {
    setDownloadingId(att.id)
    const { data, error } = await supabase.storage
      .from('evidence')
      .createSignedUrl(att.storage_path, SIGNED_URL_TTL_SECONDS)
    setDownloadingId(null)
    if (error || !data?.signedUrl) {
      setError(`No se pudo generar URL: ${error?.message ?? 'desconocido'}`)
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function handleDelete(att: EvidenceAttachment) {
    if (!confirm(`¿Borrar "${att.filename}"?`)) return
    // Borramos el blob primero; si falla, no tocamos la fila
    const blobDel = await supabase.storage.from('evidence').remove([att.storage_path])
    if (blobDel.error) {
      setError(`Borrado en Storage falló: ${blobDel.error.message}`)
      return
    }
    const rowDel = await supabase.from('evidence_attachments').delete().eq('id', att.id)
    if (rowDel.error) {
      setError(`Borrado en DB falló: ${rowDel.error.message}`)
      return
    }
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border-l border-zinc-700 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">Justificantes</h3>
            <p className="text-[11px] text-zinc-500 truncate">
              {entry.category ?? '—'}
              {entry.subcategory ? ` · ${entry.subcategory}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {attachments.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-8">
              Sin justificantes. Adjunta una factura, un informe del proveedor o cualquier evidencia que respalde la actividad.
            </p>
          ) : (
            attachments.map((att) => (
              <div
                key={att.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 flex items-start gap-3"
              >
                <div className="rounded-md bg-zinc-800 p-2 shrink-0">
                  <FileText className="h-4 w-4 text-zinc-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate" title={att.filename}>
                    {att.filename}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {fmtBytes(att.file_size_bytes)}
                    {att.mime_type ? ` · ${att.mime_type}` : ''}
                  </p>
                  {att.description && (
                    <p className="text-[10px] text-zinc-400 mt-1 line-clamp-2">{att.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleDownload(att)}
                    disabled={downloadingId === att.id}
                    className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-emerald-400 transition-colors disabled:opacity-50"
                    title="Descargar"
                  >
                    {downloadingId === att.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(att)}
                    className="rounded p-1.5 text-zinc-600 hover:bg-zinc-800 hover:text-red-400 transition-colors"
                    title="Borrar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Uploader */}
        <div className="border-t border-zinc-800 px-5 py-4 space-y-2.5">
          {error && (
            <p className="text-[11px] text-red-400 bg-red-950/40 border border-red-900/40 rounded px-2 py-1.5">
              {error}
            </p>
          )}
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción (opcional)"
            disabled={uploading}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
          />
          <label
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
              uploading
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Subiendo…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Subir archivo
              </>
            )}
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
                e.target.value = ''
              }}
            />
          </label>
          <p className="text-[10px] text-zinc-500 leading-snug">
            Path: <code className="text-zinc-400">{organizationId.slice(0, 8)}…/{entry.id.slice(0, 8)}…/&lt;timestamp&gt;-&lt;nombre&gt;</code>.
            Las URLs de descarga firman {SIGNED_URL_TTL_SECONDS}s.
          </p>
        </div>
      </div>
    </div>
  )
}
