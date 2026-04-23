-- Si el registro devuelve "Database error finding user", suele ser este trigger
-- fallando (el mensaje de Auth es engañoso). Elimínalo y deja el bootstrap en la app.
-- Ejecuta en SQL Editor de Supabase.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
