/**
 * Crea o actualiza un usuario en Supabase Auth (requiere SUPABASE_SERVICE_ROLE_KEY).
 * Uso (no guardes la contraseña en el script):
 *   CREATE_USER_EMAIL="correo@empresa.com" CREATE_USER_PASSWORD="..." \
 *     node --env-file=.env.local scripts/create-auth-user.mjs
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.CREATE_USER_EMAIL
const password = process.env.CREATE_USER_PASSWORD

if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}
if (!email || !password) {
  console.error('Define CREATE_USER_EMAIL y CREATE_USER_PASSWORD al invocar el script.')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: 'Marcos Rodríguez' },
})

if (error) {
  const msg = error.message || ''
  const duplicate =
    /already|registered|exists|duplicate/i.test(msg) || error.status === 422
  if (!duplicate) {
    console.error('Crear usuario:', error.message, error)
    if (/Database error|unexpected_failure|checking email|finding user/i.test(msg)) {
      console.error(
        '\n→ Suele ser un fallo en Postgres/Auth (triggers en auth.users, esquema, o logs con 5xx en Supabase).\n' +
          '  1) Supabase → Logs → busca errores al crear usuario.\n' +
          '  2) SQL: revisa triggers en auth.users; si creaste `handle_new_user`, aplica 20250422130000_drop_handle_new_user_trigger.sql\n' +
          '  3) Crea el usuario a mano: Authentication → Users → Add user (email, contraseña, Auto Confirm).\n',
      )
    }
    process.exit(1)
  }
  // Usuario existente: listUsers a veces falla en ciertos proyectos; generamos enlace de recovery no sirve
  // Intentamos getUser con generateLink o listUsers por pagination pequeña
  const { data: page, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })
  if (listErr) {
    console.error(
      'Crear: usuario duplicado o ya existe, pero no se pudo listar usuarios:',
      listErr.message,
      '\nCambia la contraseña en Supabase → Authentication → Users, o reintenta tras revisar el proyecto Auth.'
    )
    process.exit(1)
  }
  const found = page?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!found) {
    console.error('No se pudo localizar al usuario con ese email (lista vacía o filtro).')
    process.exit(1)
  }
  const { data: up, error: uerr } = await admin.auth.admin.updateUserById(found.id, {
    password,
    email_confirm: true,
  })
  if (uerr) {
    console.error('Actualizar contraseña:', uerr.message)
    process.exit(1)
  }
  console.log('Usuario ya existía; contraseña actualizada. id =', up.user?.id)
  process.exit(0)
}

console.log('Usuario creado (email verificado). id =', data.user?.id)
process.exit(0)
