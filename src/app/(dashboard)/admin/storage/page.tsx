import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/ui/header'
import { listOrphanedEvidenceBlobs } from '@/lib/admin/storage-actions'
import { StorageManager } from './storage-manager'

export default async function StoragePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  if (profile?.role !== 'admin') {
    return (
      <>
        <Header title="Storage" description="Acceso restringido" profile={profile} />
        <div className="p-8">
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 max-w-xl">
            <h2 className="text-sm font-semibold text-red-300 mb-1.5">Forbidden</h2>
            <p className="text-xs text-zinc-300">
              Sólo administradores. Tu rol:{' '}
              <code className="text-zinc-200">{profile?.role ?? 'sin asignar'}</code>.
            </p>
          </div>
        </div>
      </>
    )
  }

  const initial = await listOrphanedEvidenceBlobs()

  return (
    <>
      <Header title="Storage" description="Mantenimiento del bucket evidence" profile={profile} />

      <div className="p-8 space-y-6 max-w-4xl">
        {/* Nota pedagógica */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
          <h2 className="text-sm font-semibold text-blue-300 mb-1.5">Por qué esta página existe</h2>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Cada vez que se borra una <code className="text-zinc-400">emission_entry</code> con
            attachments, las filas de <code className="text-zinc-400">evidence_attachments</code> se
            limpian por la FK cascade pero los blobs físicos en el bucket quedaban huérfanos.
            Desde <strong>v1.2.3</strong> el borrado de entries vía la UI dispara una server action
            que limpia los blobs primero. Esta página existe para purgar los huérfanos
            <strong> pre-existentes</strong> a v1.2.3 (acumulados desde la creación del bucket).
          </p>
          <p className="text-xs text-zinc-300 leading-relaxed mt-2">
            La purga es <strong>idempotente</strong> y limitada a tu organización
            (filtro <code className="text-zinc-400">storage.foldername(name)[1] = org_id</code> en la
            función SQL <code className="text-zinc-400">list_orphan_evidence_blobs()</code>).
          </p>
        </div>

        {initial.ok ? (
          <StorageManager
            orphans={initial.orphans ?? []}
            totalAttachments={initial.totalAttachments ?? 0}
          />
        ) : (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-xs text-red-300">
            Error: {initial.error}
          </div>
        )}
      </div>
    </>
  )
}
