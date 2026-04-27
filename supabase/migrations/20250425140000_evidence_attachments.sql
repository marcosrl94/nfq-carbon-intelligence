-- ========================================================================
-- public.evidence_attachments  +  Storage bucket "evidence"
-- ========================================================================
-- Cada `emission_entry` puede llevar adjuntos (factura eléctrica, informe
-- de proveedor, survey, ticket, etc.). Sin estos justificantes no hay
-- verificación auditable.
--
-- Convención de path en Storage:  {organization_id}/{entry_id}/{filename}
-- → la primera carpeta es el org → policies hacen cumplir aislamiento RLS.

-- ── Bucket (privado) ────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

-- ── Tabla de metadatos ──────────────────────────────────────────────────
create table if not exists public.evidence_attachments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.emission_entries(id) on delete cascade,
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete set null,

  filename text not null,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  storage_path text not null unique,

  description text,

  created_at timestamptz not null default now()
);

comment on table public.evidence_attachments is
  'Justificantes (facturas, informes, surveys) por emission_entry. Storage en bucket "evidence".';

create index if not exists idx_evidence_entry on public.evidence_attachments(entry_id);
create index if not exists idx_evidence_uploaded_by on public.evidence_attachments(uploaded_by);

-- ── Audit ───────────────────────────────────────────────────────────────
create or replace function public.audit_evidence_attachments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  p jsonb;
begin
  select i.organization_id into org_id
  from public.emission_entries e
  join public.ghg_inventories i on i.id = e.inventory_id
  where e.id = coalesce(new.entry_id, old.entry_id);
  p := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  perform public.log_audit(org_id, 'evidence_attachments.' || lower(tg_op), p);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_audit_evidence on public.evidence_attachments;
create trigger trg_audit_evidence
  after insert or update or delete on public.evidence_attachments
  for each row execute function public.audit_evidence_attachments();

-- ── RLS sobre la tabla (acceso si la entry está en una inventario de tu org) ─
alter table public.evidence_attachments enable row level security;

drop policy if exists "evidence_org" on public.evidence_attachments;
create policy "evidence_org" on public.evidence_attachments
  for all
  using (
    exists (
      select 1
      from public.emission_entries e
      join public.ghg_inventories i on i.id = e.inventory_id
      where e.id = evidence_attachments.entry_id
        and i.organization_id = public.app_user_org()
    )
  )
  with check (
    exists (
      select 1
      from public.emission_entries e
      join public.ghg_inventories i on i.id = e.inventory_id
      where e.id = entry_id
        and i.organization_id = public.app_user_org()
    )
  );

-- ── RLS sobre storage.objects en el bucket "evidence" ───────────────────
-- Path enforce: la primera carpeta del object name DEBE ser el org_id del
-- usuario autenticado. Esto cubre lectura, subida, modificación y borrado.

drop policy if exists "evidence_storage_select" on storage.objects;
create policy "evidence_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = public.app_user_org()::text
  );

drop policy if exists "evidence_storage_insert" on storage.objects;
create policy "evidence_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = public.app_user_org()::text
  );

drop policy if exists "evidence_storage_update" on storage.objects;
create policy "evidence_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = public.app_user_org()::text
  )
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = public.app_user_org()::text
  );

drop policy if exists "evidence_storage_delete" on storage.objects;
create policy "evidence_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = public.app_user_org()::text
  );
