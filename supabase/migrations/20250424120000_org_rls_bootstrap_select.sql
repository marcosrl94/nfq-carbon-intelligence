-- FIX: insert().select() en RLS: RETURNING ve la fila si created_by_user_id = auth.uid() o profiles ya enlaza.
-- No usa public.app_user_org().

-- Esquema: asegura la columna (evita 42703 si el ALTER anterior falló o solo pegaste el bloque de policies).
do $$
begin
  if not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'organizations'
      and c.column_name = 'created_by_user_id'
  ) then
    alter table public.organizations
      add column created_by_user_id uuid;
  end if;
end $$;

comment on column public.organizations.created_by_user_id is 'Creador en bootstrap (ensureUserProfile); desbloquea SELECT tras INSERT antes de profiles.';

drop policy if exists "org_select" on public.organizations;
create policy "org_select" on public.organizations
  for select using (
    id = (select p.organization_id from public.profiles p where p.id = auth.uid() limit 1)
    or created_by_user_id = auth.uid()
  );

drop policy if exists "org_insert_first" on public.organizations;
create policy "org_insert_first" on public.organizations
  for insert with check (
    auth.uid() is not null
    and created_by_user_id = auth.uid()
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id is not null
    )
  );
