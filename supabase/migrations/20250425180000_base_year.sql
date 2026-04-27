-- ========================================================================
-- v1.2 Tanda A — Base year designation + recálculo threshold
-- ========================================================================
-- GHG Protocol Corporate Standard §5: el "año base" es el año de referencia
-- contra el que se mide el progreso de descarbonización. Debe poder
-- recalcularse cuando hay cambios estructurales (acquisitions, divestments,
-- methodology changes, EF updates, error corrections) que excedan un
-- threshold de significancia (default 5%).
--
-- Esta migración cubre la designación. El motor de recálculo va en
-- la Tanda B (20250425190000_base_year_recalculations.sql).

alter table public.organizations
  add column if not exists base_year int
    check (base_year is null or base_year between 1990 and 2100);

alter table public.organizations
  add column if not exists base_year_locked_at timestamptz;

alter table public.organizations
  add column if not exists recalc_threshold_pct numeric not null default 5
    check (recalc_threshold_pct >= 0 and recalc_threshold_pct <= 100);

comment on column public.organizations.base_year is
  'Año base GHG Protocol contra el que se mide progreso. Apunta a un fiscal_year de ghg_inventories (debería estar verified).';
comment on column public.organizations.base_year_locked_at is
  'Si está set, el base_year está bloqueado y solo admin puede desbloquearlo.';
comment on column public.organizations.recalc_threshold_pct is
  'Porcentaje de cambio que dispara propuesta de recálculo del base year (default 5% — recomendación GHG Protocol).';

-- ── Historial inmutable de cambios al base year ────────────────────────
create table if not exists public.base_year_metadata (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  base_year int not null check (base_year between 1990 and 2100),
  set_at timestamptz not null default now(),
  set_by uuid references auth.users(id) on delete set null,
  reason text,
  -- Marca cuándo este registro fue reemplazado por otro (no se borran filas).
  superseded_at timestamptz
);

comment on table public.base_year_metadata is
  'Historial de asignaciones de base year. Inmutable: cada cambio crea fila nueva y marca la previa con superseded_at.';

create index if not exists idx_byaml_org on public.base_year_metadata(organization_id);
create index if not exists idx_byaml_active on public.base_year_metadata(organization_id)
  where superseded_at is null;

-- RLS — usa los wrappers app_user_org() y app_user_role() (compat shim 110000)
alter table public.base_year_metadata enable row level security;

drop policy if exists "byaml_select" on public.base_year_metadata;
drop policy if exists "byaml_insert" on public.base_year_metadata;
drop policy if exists "byaml_update" on public.base_year_metadata;

create policy "byaml_select" on public.base_year_metadata
  for select using (organization_id = public.app_user_org());

create policy "byaml_insert" on public.base_year_metadata
  for insert with check (
    organization_id = public.app_user_org()
    and public.app_user_role() = 'admin'
  );

-- Sólo update sobre superseded_at (no permitir cambiar base_year ni reason)
create policy "byaml_update" on public.base_year_metadata
  for update using (
    organization_id = public.app_user_org()
    and public.app_user_role() = 'admin'
  ) with check (
    organization_id = public.app_user_org()
    and public.app_user_role() = 'admin'
  );

-- No DELETE (auditoría inmutable). El borrado de la fila padre
-- (organization) cascadea por la FK.

-- ── Audit ───────────────────────────────────────────────────────────────
create or replace function public.audit_base_year_metadata()
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
    'base_year_metadata.' || lower(tg_op),
    p
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_audit_byaml on public.base_year_metadata;
create trigger trg_audit_byaml
  after insert or update on public.base_year_metadata
  for each row execute function public.audit_base_year_metadata();
