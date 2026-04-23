/**
 * Aplica en remoto: supabase/migrations/20250422130000_drop_handle_new_user_trigger.sql
 * Necesita en .env.local: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_DB_PASSWORD
 * (Settings → Database → contraseña de la base, no el anon/service role)
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { Client } = pg

const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const password = process.env.SUPABASE_DB_PASSWORD

if (!publicUrl) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL en .env.local')
  process.exit(1)
}
if (!password) {
  console.error(
    'Falta SUPABASE_DB_PASSWORD (Supabase → Project Settings → Database → contraseña de Postgres / Reset). Añádela a .env.local y vuelve a: npm run db:drop-auth-trigger'
  )
  process.exit(1)
}

const m = publicUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co\/?/i)
if (!m) {
  console.error('NEXT_PUBLIC_SUPABASE_URL no es una URL de proyecto Supabase (…supabase.co).')
  process.exit(1)
}
const ref = m[1]
const host = `db.${ref}.supabase.co`

const client = new Client({
  host,
  port: 5432,
  user: 'postgres',
  password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

const sqlPath = join(
  __dirname,
  '../supabase/migrations/20250422130000_drop_handle_new_user_trigger.sql'
)
const sql = readFileSync(sqlPath, 'utf8')

try {
  await client.connect()
  await client.query(sql)
  console.log('Listo: trigger/función handle_new_user eliminados (si existían).')
} catch (e) {
  const msg = e && typeof e === 'object' && 'message' in e ? e.message : String(e)
  console.error('Error ejecutando SQL:', msg)
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}
