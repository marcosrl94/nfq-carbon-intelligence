/**
 * Aplica en remoto: supabase/migrations/20250422130000_drop_handle_new_user_trigger.sql
 *
 * Variables en .env.local (elige UNA de las formas de conectar):
 * - `SUPABASE_DB_PASSWORD` + `NEXT_PUBLIC_SUPABASE_URL` (host directo db.<ref>.supabase.co:5432)
 * - `SUPABASE_POSTGRES_URL` o `DATABASE_URL` — URI completa, p. ej. la del
 *   **Connection pooling** (Transaction) del panel de Supabase: suele usar IPv4 si el host
 *   directo solo tiene AAAA y tu red no enruta IPv6.
 *
 * Contraseña: Project Settings → Database (Postgres, no anon/service key).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { Client } = pg

const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const password = process.env.SUPABASE_DB_PASSWORD
const urlOverride = process.env.SUPABASE_POSTGRES_URL || process.env.DATABASE_URL

const sqlPath = join(
  __dirname,
  '../supabase/migrations/20250422130000_drop_handle_new_user_trigger.sql'
)
const sql = readFileSync(sqlPath, 'utf8')

function buildClientFromUrl(connectionString) {
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })
}

function buildClientFromRef() {
  if (!publicUrl) {
    console.error('Falta NEXT_PUBLIC_SUPABASE_URL en .env.local')
    process.exit(1)
  }
  if (!password) {
    console.error(
      'Falta SUPABASE_DB_PASSWORD (Supabase → Project Settings → Database). Añádela a .env.local.'
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
  return new Client({
    host,
    port: 5432,
    user: 'postgres',
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  })
}

const client = urlOverride
  ? buildClientFromUrl(urlOverride)
  : buildClientFromRef()

try {
  await client.connect()
  await client.query(sql)
  console.log('Listo: trigger/función handle_new_user eliminados (si existían).')
} catch (e) {
  const msg = e && typeof e === 'object' && 'message' in e ? e.message : String(e)
  console.error('Error ejecutando SQL:', msg)
  if (/EHOSTUNREACH|ENOTFOUND|getaddrinfo/i.test(msg)) {
    console.error('')
    console.error(
      'Si el host directo (db.*.supabase.co) solo resuelve a IPv6 y tu red no lo alcanza, añade en .env.local'
    )
    console.error(
      'la URI de **Transaction pooler** (Supabase → Connect → Connection string → URI, modo pooler) como:'
    )
    console.error('  SUPABASE_POSTGRES_URL=postgresql://postgres.<ref>:<password>@<pooler-host>:6543/postgres')
    console.error('O pega y ejecuta esto en Supabase → SQL → New query:')
    console.error('---')
    console.error(sql.trim())
    console.error('---')
  }
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}
