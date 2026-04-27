-- ========================================================================
-- v1.2 Tanda B — base_year_recalculations
-- ========================================================================
-- GHG Protocol §5.4: cuando hay un cambio estructural significativo
-- (acquisition / divestment / methodology change / EF update /
-- error_correction / other), si el impacto excede el threshold (definido
-- en organizations.recalc_threshold_pct), HAY que recalcular el año base
-- y dejar trazabilidad.
--
-- Esta tabla guarda cada propuesta/aplicación de recálculo con:
--   · tipo de cambio estructural
--   · snapshots pre y post (jsonb con totales por scope)
--   · threshold vigente en el momento del cálculo
--   · applied (si finalmente se aplicó al base year)
--
-- Inmutabilidad: una vez applied=true, la fila no se borra ni edita.

create table if not exists public.base_year_recalculations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Año base sobre el que se propone recalcular (puede no ser el activo
  -- al momento de aplicar, si entretanto cambió).
  target_base_year int not null check (target_base_year between 1990 and 2100),

  -- Tipo de cambio estructural (alineado con GHG Protocol §5)
  structural_change_type text not null check (structural_change_type in (
    'acquisition', 'divestment', 'methodology_change',
    'ef_update', 'error_correction', 'other'
  )),
  reason text not null,

  -- Snapshots: { s1: number, s2_location: number, s2_market: number,
  --              s3: number, total_location: number, total_market: number }
  pre_recalc_snapshot jsonb not null,
  post_recalc_snapshot jsonb not null,

  -- Delta % calculado al momento del análisis (sobre total_location).
  delta_pct numeric not null,
  -- Threshold en organizations.recalc_threshold_pct cuando se generó.
  threshold_pct_at_time numeric not null,
  -- ¿Excede el threshold? (calculado: |delta_pct| >= threshold)
  exceeds_threshold boolean generated always as (
    abs(delta_pct) >= threshold_pct_at_time
  ) stored,

  -- Estado del recálculo
  proposed_at timestamptz not null default now(),
  proposed_by uuid references auth.users(id) on delete set null,
  applied boolean not null default false,
  applied_at timestamptz,
  applied_by uuid references auth.users(id) on delete set null,
  -- Si applied=true, este es el snapshot que sobrescribió el base year.
  applied_notes text
);

comment on table public.base_year_recalculations is
  'Propuestas y aplicaciones de recálculo del año base (GHG Protocol §5.4). Inmutable una vez applied=true.';

create index if not exists idx_byrec_org on public.base_year_recalculations(organization_id);
create index if not exists idx_byrec_pending on public.base_year_recalculations(organization_id)
  where applied = false;
create index if not exists idx_byrec_applied_at on public.base_year_recalculations(applied_at)
  where applied = true;

-- RLS — admin-only para escritura, lectura para todos los miembros de la org.
alter table public.base_year_recalculations enable row level security;

drop policy if exists "byrec_select" on public.base_year_recalculations;
drop policy if exists "byrec_insert" on public.base_year_recalculations;
drop policy if exists "byrec_update" on public.base_year_recalculations;

create policy "byrec_select" on public.base_year_recalculations
  for select using (organization_id = public.app_user_org());

create policy "byrec_insert" on public.base_year_recalculations
  for insert with check (
    organization_id = public.app_user_org()
    and public.app_user_role() = 'admin'
  );

-- Update sólo permite cambiar applied / applied_at / applied_by / applied_notes
-- (para registrar que se aplicó). NO permite re-escribir snapshots.
create policy "byrec_update" on public.base_year_recalculations
  for update using (
    organization_id = public.app_user_org()
    and public.app_user_role() = 'admin'
  ) with check (
    organization_id = public.app_user_org()
    and public.app_user_role() = 'admin'
  );

-- Audit
create or replace function public.audit_base_year_recalculations()
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
    'base_year_recalculations.' || lower(tg_op),
    p
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_audit_byrec on public.base_year_recalculations;
create trigger trg_audit_byrec
  after insert or update on public.base_year_recalculations
  for each row execute function public.audit_base_year_recalculations();
