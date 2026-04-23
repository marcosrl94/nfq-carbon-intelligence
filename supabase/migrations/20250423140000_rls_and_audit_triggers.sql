-- Row Level Security por organización + registro básico en audit_log_entries.
-- Aplicar con la CLI o pegando en el SQL Editor del proyecto.
-- El service role (ensureUserProfile, jobs) no queda restringido por RLS en la práctica
-- (operaciones con service key).

-- Helper: organización del usuario autenticado
create or replace function public.app_user_org()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid() limit 1;
$$;

comment on function public.app_user_org() is 'RLS: organization_id de auth.uid()';

-- ——— audit ———
create or replace function public.log_audit(
  p_org uuid,
  p_action text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_org is null then
    return;
  end if;
  insert into public.audit_log_entries (organization_id, user_id, action, payload)
  values (p_org, auth.uid(), p_action, p_payload);
end;
$$;

create or replace function public.audit_ghg_inventories()
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
    'ghg_inventories.' || lower(tg_op),
    p
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.audit_emission_entries()
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
  from public.ghg_inventories i
  where i.id = coalesce(new.inventory_id, old.inventory_id);
  p := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  perform public.log_audit(org_id, 'emission_entries.' || lower(tg_op), p);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.audit_decarb_targets()
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
    'decarb_targets.' || lower(tg_op),
    p
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.audit_regulatory_disclosures()
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
  from public.ghg_inventories i
  where i.id = coalesce(new.inventory_id, old.inventory_id);
  p := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  perform public.log_audit(org_id, 'regulatory_disclosures.' || lower(tg_op), p);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.audit_invitations()
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
    'invitations.' || lower(tg_op),
    p
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_audit_ghg on public.ghg_inventories;
create trigger trg_audit_ghg
  after insert or update or delete on public.ghg_inventories
  for each row execute function public.audit_ghg_inventories();

drop trigger if exists trg_audit_emission on public.emission_entries;
create trigger trg_audit_emission
  after insert or update or delete on public.emission_entries
  for each row execute function public.audit_emission_entries();

drop trigger if exists trg_audit_decarb on public.decarb_targets;
create trigger trg_audit_decarb
  after insert or update or delete on public.decarb_targets
  for each row execute function public.audit_decarb_targets();

drop trigger if exists trg_audit_disclosure on public.regulatory_disclosures;
create trigger trg_audit_disclosure
  after insert or update or delete on public.regulatory_disclosures
  for each row execute function public.audit_regulatory_disclosures();

drop trigger if exists trg_audit_inv on public.invitations;
create trigger trg_audit_inv
  after insert or update or delete on public.invitations
  for each row execute function public.audit_invitations();

-- ——— RLS ———
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.ghg_inventories enable row level security;
alter table public.emission_entries enable row level security;
alter table public.decarb_targets enable row level security;
alter table public.regulatory_disclosures enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log_entries enable row level security;

drop policy if exists "org_select" on public.organizations;
create policy "org_select" on public.organizations
  for select using (id = public.app_user_org());

drop policy if exists "org_update" on public.organizations;
create policy "org_update" on public.organizations
  for update using (id = public.app_user_org()) with check (id = public.app_user_org());

drop policy if exists "org_insert_first" on public.organizations;
create policy "org_insert_first" on public.organizations
  for insert with check (
    auth.uid() is not null
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id is not null
    )
  );

drop policy if exists "profiles_read_org" on public.profiles;
create policy "profiles_read_org" on public.profiles
  for select using (
    id = auth.uid()
    or (organization_id is not null and organization_id = public.app_user_org())
  );

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid());

-- Inventarios: mismo org
drop policy if exists "inv_inventories" on public.ghg_inventories;
create policy "inv_inventories" on public.ghg_inventories
  for all using (organization_id = public.app_user_org())
  with check (organization_id = public.app_user_org());

-- Entradas: inventario de la org
drop policy if exists "inv_emissions" on public.emission_entries;
create policy "inv_emissions" on public.emission_entries
  for all using (
    exists (
      select 1 from public.ghg_inventories g
      where g.id = emission_entries.inventory_id
        and g.organization_id = public.app_user_org()
    )
  )
  with check (
    exists (
      select 1 from public.ghg_inventories g
      where g.id = inventory_id
        and g.organization_id = public.app_user_org()
    )
  );

-- Targets
drop policy if exists "inv_decarb" on public.decarb_targets;
create policy "inv_decarb" on public.decarb_targets
  for all using (organization_id = public.app_user_org())
  with check (organization_id = public.app_user_org());

-- Disclosures: vía inventario
drop policy if exists "inv_regulatory" on public.regulatory_disclosures;
create policy "inv_regulatory" on public.regulatory_disclosures
  for all using (
    exists (
      select 1 from public.ghg_inventories g
      where g.id = regulatory_disclosures.inventory_id
        and g.organization_id = public.app_user_org()
    )
  )
  with check (
    exists (
      select 1 from public.ghg_inventories g
      where g.id = inventory_id
        and g.organization_id = public.app_user_org()
    )
  );

-- Invitaciones: mismo org
drop policy if exists "inv_invites" on public.invitations;
create policy "inv_invites" on public.invitations
  for all using (organization_id = public.app_user_org())
  with check (organization_id = public.app_user_org());

-- Auditoría: solo lectura de la org (escritura vía triggers security definer)
drop policy if exists "audit_read_org" on public.audit_log_entries;
create policy "audit_read_org" on public.audit_log_entries
  for select using (organization_id = public.app_user_org());
