-- ========================================================================
-- v1.2 Tanda C — NACE sectors + industry_materiality reference
-- ========================================================================
-- Tablas de REFERENCIA (read-only desde la app, escritura sólo vía SQL/seed).
--
-- nace_sectors: NACE Rev 2.1 a nivel de sección (letras A–U, 21) y división
-- (códigos 01–99, ~88). Usamos esto como taxonomía sectorial canónica para
-- materiality profiling. Es lo que pide CSRD/EFRAG.
--
-- industry_materiality: para cada (sector, scope/categoría) la materialidad
-- esperada (0–3). Datos derivados de EFRAG ESRS sector standards drafts +
-- SASB Materiality Map, simplificados.
--
-- Niveles de materialidad:
--   0 = no material (no aplica al sector)
--   1 = potencial (depende de la actividad concreta)
--   2 = material (esperable para todo el sector)
--   3 = alta materialidad (hotspot principal del sector)
--
-- RLS: select abierto a autenticados. Sin escritura desde la app.

-- ── nace_sectors ────────────────────────────────────────────────────────
create table if not exists public.nace_sectors (
  code text primary key,                  -- 'A', 'A.01', '10', 'C.10', etc.
  level text not null check (level in ('section', 'division')),
  parent_code text references public.nace_sectors(code) on delete set null,
  label_es text not null,
  label_en text not null,
  notes text
);

comment on table public.nace_sectors is
  'NACE Rev 2.1 — taxonomía sectorial canónica (CSRD/EFRAG). Niveles soportados: section (A-U) y division (códigos 01-99).';

create index if not exists idx_nace_level on public.nace_sectors(level);
create index if not exists idx_nace_parent on public.nace_sectors(parent_code);

alter table public.nace_sectors enable row level security;

drop policy if exists "nace_read_all" on public.nace_sectors;
create policy "nace_read_all" on public.nace_sectors
  for select to authenticated using (true);

-- ── industry_materiality ────────────────────────────────────────────────
create table if not exists public.industry_materiality (
  id uuid primary key default gen_random_uuid(),
  sector_code text not null references public.nace_sectors(code) on delete cascade,

  -- Categoría que se evalúa: 's1', 's2', o 's3.cat1' ... 's3.cat15' (15 cats GHG Protocol).
  -- Convención: para s1/s2 usamos 's1' / 's2'. Para s3 desglosamos por categoría.
  scope_category text not null check (scope_category ~ '^s[123](\.cat([1-9]|1[0-5]))?$'),

  materiality smallint not null check (materiality between 0 and 3),
  source_framework text not null check (source_framework in (
    'EFRAG_ESRS', 'SASB', 'GHG_Protocol', 'NFQ_internal'
  )),
  notes text,

  unique (sector_code, scope_category, source_framework)
);

comment on table public.industry_materiality is
  'Matriz de materialidad por sector × scope/categoría. Niveles 0=no material, 1=potencial, 2=material, 3=alta materialidad (hotspot).';

create index if not exists idx_imat_sector on public.industry_materiality(sector_code);
create index if not exists idx_imat_scope on public.industry_materiality(scope_category);

alter table public.industry_materiality enable row level security;

drop policy if exists "imat_read_all" on public.industry_materiality;
create policy "imat_read_all" on public.industry_materiality
  for select to authenticated using (true);

-- ── Override per-organization (opcional) ────────────────────────────────
-- Permite al admin sobrescribir la materialidad para su org concreta con
-- justificación. Útil cuando una org tiene un perfil atípico.
create table if not exists public.org_materiality_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sector_code text not null references public.nace_sectors(code) on delete cascade,
  scope_category text not null check (scope_category ~ '^s[123](\.cat([1-9]|1[0-5]))?$'),
  materiality smallint not null check (materiality between 0 and 3),
  justification text not null,
  set_at timestamptz not null default now(),
  set_by uuid references auth.users(id) on delete set null,

  unique (organization_id, sector_code, scope_category)
);

comment on table public.org_materiality_overrides is
  'Overrides de materialidad por org sobre la matriz industry_materiality. Requiere justificación.';

create index if not exists idx_omo_org on public.org_materiality_overrides(organization_id);

alter table public.org_materiality_overrides enable row level security;

drop policy if exists "omo_select" on public.org_materiality_overrides;
drop policy if exists "omo_insert" on public.org_materiality_overrides;
drop policy if exists "omo_update" on public.org_materiality_overrides;
drop policy if exists "omo_delete" on public.org_materiality_overrides;

create policy "omo_select" on public.org_materiality_overrides
  for select using (organization_id = public.app_user_org());

create policy "omo_insert" on public.org_materiality_overrides
  for insert with check (
    organization_id = public.app_user_org()
    and public.app_user_role() = 'admin'
  );

create policy "omo_update" on public.org_materiality_overrides
  for update using (
    organization_id = public.app_user_org()
    and public.app_user_role() = 'admin'
  ) with check (
    organization_id = public.app_user_org()
    and public.app_user_role() = 'admin'
  );

create policy "omo_delete" on public.org_materiality_overrides
  for delete using (
    organization_id = public.app_user_org()
    and public.app_user_role() = 'admin'
  );

-- Audit
create or replace function public.audit_org_materiality_overrides()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p jsonb;
begin
  p := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  perform public.log_audit(
    coalesce(new.organization_id, old.organization_id),
    'org_materiality_overrides.' || lower(tg_op),
    p
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_audit_omo on public.org_materiality_overrides;
create trigger trg_audit_omo
  after insert or update or delete on public.org_materiality_overrides
  for each row execute function public.audit_org_materiality_overrides();
