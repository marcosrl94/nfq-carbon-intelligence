-- ========================================================================
-- Hardening RLS por rol — matriz admin/analyst/client/auditor
-- ========================================================================
-- v1.0 usaba `for all` con sólo el predicado de organización: cualquier
-- usuario de la org podía escribir cualquier tabla. v1.1 separa por
-- operación y exige rol para escrituras.
--
-- MATRIZ:
--                         | admin | analyst | client | auditor |
--   ghg_inventories       | RWUD  | RWU     | R      | R       |
--   emission_entries      | RWUD  | RWUD    | R      | R       |
--   decarb_targets        | RWUD  | RWU     | R      | R       |
--   regulatory_disclosures| RWUD  | RWU     | R      | R       |
--   renewable_instruments | RWUD  | RWUD    | R      | R       |
--   evidence_attachments  | RWUD  | RWUD    | R      | R       |
--   carbon_removals       | RWUD  | RWUD    | R      | R       |
--   invitations           | RWUD  | -       | -      | -       |
--   organizations         | U+R   | R       | R      | R       |  (insert: bootstrap policy)
--   profiles              | self+R org · admin update otros | R | R |
--   audit_log_entries     | R     | -       | -      | R       |
--
-- (R=select, W=insert, U=update, D=delete)
--
-- Compatibilidad con bootstrap: la policy `org_insert_first` de
-- 20250424120000 se preserva (no se borra). El usuario nuevo aún no
-- tiene profile, así que `app_user_role()` es null y los nuevos checks
-- de rol no aplican a la creación inicial.

-- ── Helper: rol del usuario actual ──────────────────────────────────────
create or replace function public.app_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;

comment on function public.app_user_role() is 'RLS: rol del auth.uid() (admin/analyst/client/auditor) o NULL si aún no hay profile.';

-- ── ghg_inventories ─────────────────────────────────────────────────────
drop policy if exists "inv_inventories" on public.ghg_inventories;
drop policy if exists "ghg_inv_select" on public.ghg_inventories;
drop policy if exists "ghg_inv_insert" on public.ghg_inventories;
drop policy if exists "ghg_inv_update" on public.ghg_inventories;
drop policy if exists "ghg_inv_delete" on public.ghg_inventories;

create policy "ghg_inv_select" on public.ghg_inventories
  for select using (organization_id = public.app_user_org());
create policy "ghg_inv_insert" on public.ghg_inventories
  for insert with check (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('admin', 'analyst')
  );
create policy "ghg_inv_update" on public.ghg_inventories
  for update using (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('admin', 'analyst')
  ) with check (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('admin', 'analyst')
  );
create policy "ghg_inv_delete" on public.ghg_inventories
  for delete using (
    organization_id = public.app_user_org()
    and public.app_user_role() = 'admin'
  );

-- ── emission_entries (acceso vía inventario→org) ─────────────────────────
drop policy if exists "inv_emissions" on public.emission_entries;
drop policy if exists "entries_select" on public.emission_entries;
drop policy if exists "entries_insert" on public.emission_entries;
drop policy if exists "entries_update" on public.emission_entries;
drop policy if exists "entries_delete" on public.emission_entries;

create policy "entries_select" on public.emission_entries
  for select using (
    exists (
      select 1 from public.ghg_inventories g
      where g.id = emission_entries.inventory_id
        and g.organization_id = public.app_user_org()
    )
  );
create policy "entries_insert" on public.emission_entries
  for insert with check (
    public.app_user_role() in ('admin', 'analyst')
    and exists (
      select 1 from public.ghg_inventories g
      where g.id = inventory_id
        and g.organization_id = public.app_user_org()
    )
  );
create policy "entries_update" on public.emission_entries
  for update using (
    public.app_user_role() in ('admin', 'analyst')
    and exists (
      select 1 from public.ghg_inventories g
      where g.id = emission_entries.inventory_id
        and g.organization_id = public.app_user_org()
    )
  ) with check (
    public.app_user_role() in ('admin', 'analyst')
    and exists (
      select 1 from public.ghg_inventories g
      where g.id = inventory_id
        and g.organization_id = public.app_user_org()
    )
  );
create policy "entries_delete" on public.emission_entries
  for delete using (
    public.app_user_role() in ('admin', 'analyst')
    and exists (
      select 1 from public.ghg_inventories g
      where g.id = emission_entries.inventory_id
        and g.organization_id = public.app_user_org()
    )
  );

-- ── decarb_targets ──────────────────────────────────────────────────────
drop policy if exists "inv_decarb" on public.decarb_targets;
drop policy if exists "targets_select" on public.decarb_targets;
drop policy if exists "targets_insert" on public.decarb_targets;
drop policy if exists "targets_update" on public.decarb_targets;
drop policy if exists "targets_delete" on public.decarb_targets;

create policy "targets_select" on public.decarb_targets
  for select using (organization_id = public.app_user_org());
create policy "targets_insert" on public.decarb_targets
  for insert with check (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('admin', 'analyst')
  );
create policy "targets_update" on public.decarb_targets
  for update using (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('admin', 'analyst')
  ) with check (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('admin', 'analyst')
  );
create policy "targets_delete" on public.decarb_targets
  for delete using (
    organization_id = public.app_user_org()
    and public.app_user_role() = 'admin'
  );

-- ── regulatory_disclosures (acceso vía inventario→org) ──────────────────
drop policy if exists "inv_regulatory" on public.regulatory_disclosures;
drop policy if exists "disc_select" on public.regulatory_disclosures;
drop policy if exists "disc_insert" on public.regulatory_disclosures;
drop policy if exists "disc_update" on public.regulatory_disclosures;
drop policy if exists "disc_delete" on public.regulatory_disclosures;

create policy "disc_select" on public.regulatory_disclosures
  for select using (
    exists (
      select 1 from public.ghg_inventories g
      where g.id = regulatory_disclosures.inventory_id
        and g.organization_id = public.app_user_org()
    )
  );
create policy "disc_insert" on public.regulatory_disclosures
  for insert with check (
    public.app_user_role() in ('admin', 'analyst')
    and exists (
      select 1 from public.ghg_inventories g
      where g.id = inventory_id
        and g.organization_id = public.app_user_org()
    )
  );
create policy "disc_update" on public.regulatory_disclosures
  for update using (
    public.app_user_role() in ('admin', 'analyst')
    and exists (
      select 1 from public.ghg_inventories g
      where g.id = regulatory_disclosures.inventory_id
        and g.organization_id = public.app_user_org()
    )
  ) with check (
    public.app_user_role() in ('admin', 'analyst')
    and exists (
      select 1 from public.ghg_inventories g
      where g.id = inventory_id
        and g.organization_id = public.app_user_org()
    )
  );
create policy "disc_delete" on public.regulatory_disclosures
  for delete using (
    public.app_user_role() = 'admin'
    and exists (
      select 1 from public.ghg_inventories g
      where g.id = regulatory_disclosures.inventory_id
        and g.organization_id = public.app_user_org()
    )
  );

-- ── invitations (admin only) ────────────────────────────────────────────
drop policy if exists "inv_invites" on public.invitations;
drop policy if exists "invites_select" on public.invitations;
drop policy if exists "invites_write" on public.invitations;

create policy "invites_select" on public.invitations
  for select using (organization_id = public.app_user_org() and public.app_user_role() = 'admin');
create policy "invites_write" on public.invitations
  for all
  using (organization_id = public.app_user_org() and public.app_user_role() = 'admin')
  with check (organization_id = public.app_user_org() and public.app_user_role() = 'admin');

-- ── organizations ───────────────────────────────────────────────────────
-- select y bootstrap_insert ya existen (20250424120000). Sólo endurecemos UPDATE.
drop policy if exists "org_update" on public.organizations;
create policy "org_update" on public.organizations
  for update
  using (id = public.app_user_org() and public.app_user_role() = 'admin')
  with check (id = public.app_user_org() and public.app_user_role() = 'admin');

-- ── profiles ────────────────────────────────────────────────────────────
-- Ampliamos el update: el self-update sigue válido para cualquier rol;
-- el admin puede modificar perfiles de su org (cambiar role/full_name).
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;

create policy "profiles_update_self" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_update_admin" on public.profiles
  for update
  using (
    organization_id = public.app_user_org()
    and public.app_user_role() = 'admin'
  )
  with check (
    organization_id = public.app_user_org()
    and public.app_user_role() = 'admin'
  );

-- profiles_read_org y profiles_insert_self ya existen (20250423140000); no las tocamos.

-- ── renewable_instruments ───────────────────────────────────────────────
drop policy if exists "ri_org" on public.renewable_instruments;
drop policy if exists "ri_select" on public.renewable_instruments;
drop policy if exists "ri_insert" on public.renewable_instruments;
drop policy if exists "ri_update" on public.renewable_instruments;
drop policy if exists "ri_delete" on public.renewable_instruments;

create policy "ri_select" on public.renewable_instruments
  for select using (organization_id = public.app_user_org());
create policy "ri_insert" on public.renewable_instruments
  for insert with check (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('admin', 'analyst')
  );
create policy "ri_update" on public.renewable_instruments
  for update using (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('admin', 'analyst')
  ) with check (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('admin', 'analyst')
  );
create policy "ri_delete" on public.renewable_instruments
  for delete using (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('admin', 'analyst')
  );

-- ── evidence_attachments (vía entry → inventory → org) ──────────────────
drop policy if exists "evidence_org" on public.evidence_attachments;
drop policy if exists "evidence_select" on public.evidence_attachments;
drop policy if exists "evidence_insert" on public.evidence_attachments;
drop policy if exists "evidence_update" on public.evidence_attachments;
drop policy if exists "evidence_delete" on public.evidence_attachments;

create policy "evidence_select" on public.evidence_attachments
  for select using (
    exists (
      select 1 from public.emission_entries e
      join public.ghg_inventories i on i.id = e.inventory_id
      where e.id = evidence_attachments.entry_id
        and i.organization_id = public.app_user_org()
    )
  );
create policy "evidence_insert" on public.evidence_attachments
  for insert with check (
    public.app_user_role() in ('admin', 'analyst')
    and exists (
      select 1 from public.emission_entries e
      join public.ghg_inventories i on i.id = e.inventory_id
      where e.id = entry_id
        and i.organization_id = public.app_user_org()
    )
  );
create policy "evidence_update" on public.evidence_attachments
  for update using (
    public.app_user_role() in ('admin', 'analyst')
    and exists (
      select 1 from public.emission_entries e
      join public.ghg_inventories i on i.id = e.inventory_id
      where e.id = evidence_attachments.entry_id
        and i.organization_id = public.app_user_org()
    )
  ) with check (
    public.app_user_role() in ('admin', 'analyst')
    and exists (
      select 1 from public.emission_entries e
      join public.ghg_inventories i on i.id = e.inventory_id
      where e.id = entry_id
        and i.organization_id = public.app_user_org()
    )
  );
create policy "evidence_delete" on public.evidence_attachments
  for delete using (
    public.app_user_role() in ('admin', 'analyst')
    and exists (
      select 1 from public.emission_entries e
      join public.ghg_inventories i on i.id = e.inventory_id
      where e.id = evidence_attachments.entry_id
        and i.organization_id = public.app_user_org()
    )
  );

-- ── carbon_removals ─────────────────────────────────────────────────────
drop policy if exists "removals_org" on public.carbon_removals;
drop policy if exists "removals_select" on public.carbon_removals;
drop policy if exists "removals_insert" on public.carbon_removals;
drop policy if exists "removals_update" on public.carbon_removals;
drop policy if exists "removals_delete" on public.carbon_removals;

create policy "removals_select" on public.carbon_removals
  for select using (organization_id = public.app_user_org());
create policy "removals_insert" on public.carbon_removals
  for insert with check (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('admin', 'analyst')
  );
create policy "removals_update" on public.carbon_removals
  for update using (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('admin', 'analyst')
  ) with check (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('admin', 'analyst')
  );
create policy "removals_delete" on public.carbon_removals
  for delete using (
    organization_id = public.app_user_org()
    and public.app_user_role() = 'admin'
  );

-- ── audit_log_entries (admin / auditor read) ────────────────────────────
drop policy if exists "audit_read_org" on public.audit_log_entries;
create policy "audit_read_org" on public.audit_log_entries
  for select using (
    organization_id = public.app_user_org()
    and public.app_user_role() in ('admin', 'auditor')
  );
