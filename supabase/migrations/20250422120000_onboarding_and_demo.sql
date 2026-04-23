-- Opcional o histórico: si al registrarte ves "Database error finding user", este trigger
-- puede chocar con el esquema (columnas, enums, etc.). Aplica luego
-- `20250422130000_drop_handle_new_user_trigger.sql` y deja el bootstrap en la app
-- (`ensureUserProfile` en el layout del dashboard).
--
-- Ejecuta en el SQL Editor de Supabase (Project Settings no sustituye esto).
-- 1) Crea org + perfil automáticamente al registrarse (evita filas faltantes en public.profiles).
-- 2) Ajustes manuales recomendados en el panel:
--    Authentication > Providers > Email: desactiva "Confirm email" en entornos de prueba, o
--    usa el enlace de confirmación; si no llegan emails, revisa SMTP/redirect URLs.
-- 3) Cuenta demo: Authentication > Users > Add user (email fijo, contraseña, "Auto Confirm User").
--    Copia el mismo email/contraseña a DEMO_USER_EMAIL y DEMO_USER_PASSWORD en .env.local

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  fiscal int;
begin
  fiscal := extract(year from now())::int;

  insert into public.organizations (name, sectors, geographies, consolidation, employees, revenue_eur_m, fiscal_year)
  values (
    'Mi organización',
    array[]::text[],
    array[]::text[],
    'operational',
    null,
    null,
    fiscal
  )
  returning id into new_org_id;

  insert into public.profiles (id, organization_id, role, full_name, email)
  values (
    new.id,
    new_org_id,
    'admin',
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    new.email
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is 'Crea organization + profile al registrarse; ejecuta con permisos definer.';
