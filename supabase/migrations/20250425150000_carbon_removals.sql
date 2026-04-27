-- ========================================================================
-- public.carbon_removals — removals / offsets / insets (tabla SEPARADA)
-- ========================================================================
-- GHG Protocol y ESRS exigen NO netear contra emisiones brutas. Por eso
-- esta tabla vive aparte de `emission_entries`. La UI mostrará siempre
-- las tres líneas: Gross, Removals/Offsets, Net. Nunca solo Net.
--
-- Tipos soportados (alineados con registries comunes):
--   REC          — Renewable Energy Certificate (offset, no removal)
--   VCS          — Verified Carbon Standard (Verra)
--   GoldStandard — Gold Standard
--   PlanVivo     — Plan Vivo
--   biochar      — Biochar Carbon Removal (BCR)
--   DAC          — Direct Air Capture
--   afforestation — Afforestation / reforestation
--   other        — fallback
--
-- RLS: misma org del usuario (`app_user_org()` en 20250423140000).

create table if not exists public.carbon_removals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  inventory_year int not null check (inventory_year between 1990 and 2100),
  type text not null check (type in (
    'REC', 'VCS', 'GoldStandard', 'PlanVivo', 'biochar', 'DAC', 'afforestation', 'other'
  )),
  volume_tco2e numeric not null check (volume_tco2e >= 0),

  project_name text,
  project_id text,
  vintage_year int check (vintage_year is null or vintage_year between 1990 and 2100),
  certificate_registry_url text,
  cost_eur numeric check (cost_eur is null or cost_eur >= 0),
  retirement_date date,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.carbon_removals is
  'Removals/offsets/insets (tabla separada de emission_entries). NO netear contra emisiones brutas en UI.';

create index if not exists idx_removals_org_year on public.carbon_removals(organization_id, inventory_year);
create index if not exists idx_removals_type     on public.carbon_removals(type);
create index if not exists idx_removals_retire   on public.carbon_removals(retirement_date) where retirement_date is not null;

-- updated_at via función set_updated_at() de 20250424150000_emission_factors.sql
drop trigger if exists trg_removals_updated_at on public.carbon_removals;
create trigger trg_removals_updated_at
  before update on public.carbon_removals
  for each row execute function public.set_updated_at();

-- Audit
create or replace function public.audit_carbon_removals()
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
    'carbon_removals.' || lower(tg_op),
    p
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_audit_removals on public.carbon_removals;
create trigger trg_audit_removals
  after insert or update or delete on public.carbon_removals
  for each row execute function public.audit_carbon_removals();

-- RLS
alter table public.carbon_removals enable row level security;

drop policy if exists "removals_org" on public.carbon_removals;
create policy "removals_org" on public.carbon_removals
  for all
  using (organization_id = public.app_user_org())
  with check (organization_id = public.app_user_org());
