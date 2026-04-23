# nfq-carbon-intelligence · Contexto para Claude

> Este archivo es el briefing que Claude debe leer al abrir este proyecto.
> Mantener actualizado en cada sesión de trabajo significativa.
>
> Este proyecto **también** tiene un `AGENTS.md` en la raíz con un aviso
> específico sobre la versión de Next.js. Respetar ese aviso (ver §2).

@AGENTS.md

---

## 1. Contexto y objetivo

**Qué es:** **NFQ Carbon Intelligence Platform** — plataforma SaaS multi-tenant de inteligencia de huella de carbono. El cliente carga su actividad, la plataforma calcula emisiones por scope (1 / 2 / 3), compara con objetivos de descarbonización y prepara disclosures regulatorios (TCFD / ESRS).

**A quién va dirigido:** empresas que necesitan (a) medir su inventario GHG, (b) fijar y seguir *targets* de reducción, y (c) emitir disclosures alineados con TCFD y ESRS. Usuarios internos: `admin`, `analyst`, `client`, `auditor`.

**Qué produce (dominio en `src/types/database.ts`):**
- `organizations` — cuenta cliente (sectores, geografías, consolidación, empleados, revenue)
- `profiles` — usuario ligado a organización + rol
- `ghg_inventories` — inventario por año fiscal (status: `draft` → `submitted` → `verified`)
- `emission_entries` — entradas con scope, categoría, cantidad, factor de emisión (EF) y `tco2e`
- `decarb_targets` — objetivos de reducción S1/S2/S3 + curva + *levers*
- `regulatory_disclosures` — disclosures TCFD / ESRS / AMBOS por inventario
- `audit_log_entries` — auditoría de cambios

**Dashboard actual (`src/app/(dashboard)/page.tsx`):** carga el inventario más reciente, calcula totales por scope, tendencia vs. año anterior y muestra *targets* activos. Badge de estado por inventario.

---

## 2. Stack técnico

> ⚠️ **Next.js "not the one you know"** — el `AGENTS.md` del repo avisa:
> esta versión tiene *breaking changes* respecto a lo que tiene un LLM entrenado
> hasta 2025. **Antes de tocar código**, leer la guía relevante en
> `node_modules/next/dist/docs/` y atender a las `deprecation notices`.

| Capa | Tecnología |
|---|---|
| Framework | **Next.js 16.2.3** (App Router + Route Groups `(dashboard)`) |
| UI | **React 19.2.4** + Tailwind 4 (`@tailwindcss/postcss`) |
| Lenguaje | TypeScript 5 |
| DB + Auth | **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`) |
| Email | **Resend** (`resend`) |
| Iconos | `lucide-react` |
| Hosting | Vercel (ya hay `.vercel/`) |

**Patrón de Supabase (App Router + SSR):**
- `src/lib/supabase/client.ts` — cliente browser
- `src/lib/supabase/server.ts` — cliente server (Server Components / Route Handlers)
- `src/lib/supabase/middleware.ts` — refresco de sesión en cada request
- `src/middleware.ts` — invoca `updateSession`, excluye assets estáticos

**Comandos:**
```bash
npm install
npm run dev              # http://localhost:3000
npm run build
npm run lint             # ESLint 9 (eslint-config-next)
npm run db:drop-auth-trigger  # aplica en Postgres el DROP del trigger (requiere SUPABASE_DB_PASSWORD)
```

**Variables de entorno (`.env.local`):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `DEMO_USER_EMAIL` y `DEMO_USER_PASSWORD` (servidor) — inicio con «Entrar con cuenta demo»; el usuario debe existir en **Supabase Auth** con la misma contraseña
- `SUPABASE_DB_PASSWORD` — **contraseña de Postgres** (no los JWT): *Project Settings → Database*. Solo para el script `npm run db:drop-auth-trigger` que aplica en remoto el `DROP` del trigger problemático; alternativa: pegar el SQL en el editor de Supabase

---

## 3. Estado actual y próximos pasos

**Versión:** `0.1.0`
**Última referencia de commit / estado:** comprobar con `git log -1` y `git status` (puede haber cambios locales sin publicar).
**Historial corto (4 commits):** `Initial commit → feat: MVP inicial → update → update`.

### Hecho ✅
- Proyecto Next.js 16 + React 19 + Tailwind 4 inicializado
- Integración Supabase SSR (client/server/middleware)
- Middleware de sesión activo + `ensureUserProfile` en layout del dashboard (alta org/perfil sin depender solo del trigger SQL)
- Tipos de dominio en `src/types/database.ts` (orgs, profiles, inventories, entries, targets, disclosures, audit log, invitaciones)
- **Emisiones (`/emissions`)** — creación de inventario con año fiscal y **fuente de FE** (presets); entradas por alcance, categoría GHG, tCO₂e (manual o **cantidad × factor**)
- **Objetivos (`/targets`)** — altas con framework, curva y **palancas** (`levers` como claves)
- **Disclosures (`/disclosures`)** — altas TCFD/ESRS con IDs estándar; **edición de contenido** y estado
- **Configuración (`/settings`)** — formulario de organización, listado de equipo, invitaciones (registro en tabla; email Resend aún no cableado)
- **Dashboard** — KPIs por inventario, tendencia YoY, resumen de objetivos
- Migración **`20250423140000_rls_and_audit_triggers.sql`** — RLS multi-tenant y triggers que escriben en `audit_log_entries` (inventarios, entradas, targets, disclosures, invitaciones). **Aplicar en el proyecto de Supabase** (CLI o SQL Editor) antes de producción
- Integración Resend (dependencia lista; flujo de invitación por email pendiente)
- Deploy configurado en Vercel

### Pendiente 🚧 (orden sugerido)
1. **Catálogo de factores (EF) por unidad/sector** — hoy se elige la fuente del inventario y el FE es manual; valorar tablas o integración (DEFRA/API propia) y unidades con conversión explícita
2. **Notificaciones e invitaciones** — generar enlace/ token de aceptación y enviar email con Resend; flujo "aceptar invitación"
3. **Vista de audit log** en UI (solo admin) y retención/backfill si hace falta
4. **Hardening RLS** — revisar inserción de `profiles`/`organizations` y roles; políticas `FOR ALL` simplifican pero conviene alinear con matriz de roles
5. **Resiliencia e2e** — pruebas, backups, monitoring

### Riesgos / decisiones abiertas
- **Next.js 16 + React 19** — ecosistema joven. Algunas libs pueden no soportarlo todavía. Antes de añadir deps, comprobar compatibilidad.
- **Tailwind 4** — sintaxis y pipeline cambian respecto a v3 (no hay `tailwind.config.*` clásico aquí). Confirmar que el equipo conoce la nueva forma.
- **Solape con `nfq-esg-reporting-suite`** — aquel también modela ESRS/TCFD pero con enfoque de *reporting engine* (narrativas + consolidación). Merece la pena clarificar el límite: Carbon Intelligence = cálculo + targets; Reporting Suite = presentación regulatoria.

---

## Cómo trabajar en este proyecto con Claude

- **Antes de tocar código:** releer `AGENTS.md` + la sección relevante de `node_modules/next/dist/docs/` (Next.js 16 tiene breaking changes respecto al conocimiento base).
- **Supabase:** usar `createClient` desde `lib/supabase/server.ts` en Server Components; desde `lib/supabase/client.ts` en Client Components. No mezclar.
- **Antes de cerrar una tarea:** `npm run build` (compila + lint) como smoke test mínimo.
- **No commitear ni desplegar** sin confirmación.
- **Secretos:** `.env.local` en `.gitignore`; no pegar keys en respuestas.
- **Al terminar sesión significativa:** actualizar §3 de este archivo.
