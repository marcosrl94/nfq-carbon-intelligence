-- NO pegues la ruta del fichero (p. ej. "supabase/.../list-auth-triggers.sql").
-- Abre los fichero en el editor y copia SOLO el SQL de abajo en Supabase → SQL → New query.

-- Al crear usuarios, si ves "Database error" en Auth, revisa los triggers de auth.users.
select
  event_object_table as on_table,
  trigger_name,
  event_manipulation as on_event,
  action_statement
from information_schema.triggers
where event_object_schema = 'auth'
  and event_object_table = 'users'
order by trigger_name;
