'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface DeleteResult {
  ok: boolean
  error?: string
  /** Cuántos blobs (attachments) se borraron junto con la entry. */
  deletedBlobsCount?: number
}

/**
 * Borra una `emission_entry` y limpia los blobs físicos asociados en Storage
 * antes de tirar la fila. La FK cascade se encarga de borrar las filas de
 * `evidence_attachments`, pero no toca el bucket — sin esta action, los
 * blobs quedan huérfanos.
 *
 * Orden:
 *   1) Verifica autenticación.
 *   2) Lista los `storage_path` de los attachments de la entry.
 *   3) Borra los blobs (idempotente: si un path no existe, no falla).
 *   4) Si OK, borra la entry (cascade limpia las filas).
 *   5) Si Storage falla, NO borra la entry — se mantiene consistencia.
 *
 * RLS: la sesión del usuario hace cumplir org-scope tanto en el SELECT
 * como en el DELETE; service role no se necesita aquí.
 */
export async function deleteEmissionEntry(entryId: string): Promise<DeleteResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado.' }

  // 1) Recoger paths a borrar. RLS evidence_select impone que sólo veamos
  //    attachments de inventarios de nuestra org → la query devuelve [] si
  //    el caller no pertenece a la org de la entry, y el delete posterior
  //    también fallará por RLS (defensa en profundidad).
  const { data: attachments, error: listErr } = await supabase
    .from('evidence_attachments')
    .select('storage_path')
    .eq('entry_id', entryId)

  if (listErr) {
    return { ok: false, error: `No se pudieron listar attachments: ${listErr.message}` }
  }

  const paths = (attachments ?? []).map((a) => a.storage_path).filter(Boolean) as string[]

  // 2) Borrar blobs (si los hay). Tolerante a paths inexistentes.
  if (paths.length > 0) {
    const { error: removeErr } = await supabase.storage.from('evidence').remove(paths)
    if (removeErr) {
      // No tocamos la entry para no dejar inconsistencia. El admin puede
      // reintentar o limpiar a mano.
      return {
        ok: false,
        error: `Falló el borrado de blobs en Storage (no se borró la entry para mantener consistencia): ${removeErr.message}`,
      }
    }
  }

  // 3) Borrar la entry — cascade limpia las filas de evidence_attachments.
  const { error: delErr } = await supabase.from('emission_entries').delete().eq('id', entryId)
  if (delErr) {
    return {
      ok: false,
      error: `Blobs borrados pero la entry falló (revisa permisos): ${delErr.message}`,
    }
  }

  // Refresca cualquier ruta que pinte entries (dashboard, /emissions, /materiality).
  revalidatePath('/emissions')
  revalidatePath('/')
  revalidatePath('/materiality')
  return { ok: true, deletedBlobsCount: paths.length }
}
