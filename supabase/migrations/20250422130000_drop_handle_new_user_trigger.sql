-- Registro o Auth: si ves errores de base, suele ser el trigger on_auth_user_created
-- (función public.handle_new_user) fallando; el mensaje de Supabase Auth a veces engaña.
-- Al eliminarlo, el alta de org/perfil la hace la app (p. ej. al entrar al dashboard).
--
-- Cómo aplicar (elige una):
--   A) Supabase → SQL → New query: pega TODO este fichero y ejecuta.
--   B) En la raíz del repo, con .env.local (SUPABASE_DB_PASSWORD y URL del proyecto, o
--      SUPABASE_POSTGRES_URL del pooler si IPv6 falla):
--        npm run db:drop-auth-trigger
--
-- Requiere el rol/permiso de Postgres del proyecto; no basta con la anon key.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
