-- ========================================================================
-- public.renewable_instruments — instrumentos contractuales para Scope 2
-- ========================================================================
-- Soporte para market-based reporting (GHG Protocol Scope 2 Guidance):
-- guarda los GoOs / RECs / PPAs / tarifas verdes que la organización tiene
-- contratados, su volumen en kWh y la fecha de retirado del certificado.
--
-- En esta tanda no automatizamos el match contra emission_entries; la
-- aplicación los expone para auditoría. Una iteración posterior podrá
-- reconciliar volumen contractual vs. consumo s2 market-based.
--
-- RLS: misma org del usuario (`app_user_org()` definido en la migración
-- 20250423140000_rls_and_audit_triggers.sql).

create table if not exists public.renewable_instruments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  year int not null check (year between 1990 and 2100),
  type text not null check (type in ('GoO', 'REC', 'PPA', 'green_tariff')),
  volume_kwh numeric not null check (volume_kwh >= 0),
  vintage_year int check (vintage_year is null or vintage_year between 1990 and 2100),

  certificate_id text,
  supplier text,
  cost_eur numeric check (cost_eur is null or cost_eur >= 0),
  retirement_date date,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.renewable_instruments is
  'Instrumentos contractuales para Scope 2 market-based: GoOs / RECs / PPAs / green tariffs.';

create index if not exists idx_ri_org_year   on public.renewable_instruments(organization_id, year);
create index if not exists idx_ri_type       on public.renewable_instruments(type);
create index if not exists idx_ri_retirement on public.renewable_instruments(retirement_date) where retirement_date is not null;

-- updated_at trigger reutiliza la función `set_updated_at()` ya creada en
-- 20250424150000_emission_factors.sql.
drop trigger if exists trg_ri_updated_at on public.renewable_instruments;
create trigger trg_ri_updated_at
  before update on public.renewable_instruments
  for each row execute function public.set_updated_at();

-- ——— Audit trigger ———
create or replace function public.audit_renewable_instruments()
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
    'renewable_instruments.' || lower(tg_op),
    p
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_audit_ri on public.renewable_instruments;
create trigger trg_audit_ri
  after insert or update or delete on public.renewable_instruments
  for each row execute function public.audit_renewable_instruments();

-- ——— RLS ———
alter table public.renewable_instruments enable row level security;

drop policy if exists "ri_org" on public.renewable_instruments;
create policy "ri_org" on public.renewable_instruments
  for all
  using (organization_id = public.app_user_org())
  with check (organization_id = public.app_user_org());
