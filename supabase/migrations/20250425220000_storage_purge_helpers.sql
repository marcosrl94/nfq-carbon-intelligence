-- ========================================================================
-- v1.2.4 — list_orphan_evidence_blobs()
-- ========================================================================
-- Helper para purgar blobs huérfanos pre-existentes en el bucket "evidence".
-- (Las entries borradas a partir de v1.2.3 ya limpian sus blobs vía la
-- server action deleteEmissionEntry; esta función cubre los huérfanos
-- creados ANTES de esa fecha.)
--
-- security definer porque storage.objects requiere privilegios elevados
-- al consultar metadatos del bucket. El check de admin + filtrado por
-- org_id se hace dentro de la función para evitar exfiltración cross-tenant.

create or replace function public.list_orphan_evidence_blobs()
returns table(name text, size bigint, created_at timestamptz)
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  user_org_id uuid;
begin
  user_org_id := public.app_user_org();
  -- Sin org o sin rol admin → tabla vacía (no error, falla silenciosa segura).
  if user_org_id is null or public.app_user_role() <> 'admin' then
    return;
  end if;

  return query
  select
    o.name,
    coalesce((o.metadata->>'size')::bigint, 0)::bigint as size,
    o.created_at
  from storage.objects o
  where o.bucket_id = 'evidence'
    -- Path-enforce: la primera carpeta del object name debe ser la org.
    and (storage.foldername(o.name))[1] = user_org_id::text
    and not exists (
      select 1
      from public.evidence_attachments e
      where e.storage_path = o.name
    );
end;
$$;

revoke all on function public.list_orphan_evidence_blobs() from public;
grant execute on function public.list_orphan_evidence_blobs() to authenticated;

comment on function public.list_orphan_evidence_blobs() is
  'Lista blobs en bucket "evidence" cuyo path empieza por org_id del admin y NO tienen fila en evidence_attachments. Solo accesible a admins (check interno). Usado por /admin/storage para purga manual.';
