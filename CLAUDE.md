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
- `src/lib/supabase/update-session.ts` — refresco de sesión en cada request
- `src/proxy.ts` — invoca `updateSession`, excluye assets estáticos (Next 16: convención *proxy* en lugar de *middleware* en raíz)

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

**Versión:** `0.1.0` (v1.1 "defendible ante auditor" en curso)
**Última referencia de commit / estado:** comprobar con `git log -1` y `git status` (puede haber cambios locales sin publicar).
**Historial corto (4 commits):** `Initial commit → feat: MVP inicial → update → update`.

### Hecho ✅ — v1.0 (MVP)
- Proyecto Next.js 16 + React 19 + Tailwind 4 inicializado
- Integración Supabase SSR (client/server/middleware)
- Middleware de sesión activo + `ensureUserProfile` en layout del dashboard (alta org/perfil sin depender solo del trigger SQL)
- Tipos de dominio en `src/types/database.ts` (orgs, profiles, inventories, entries, targets, disclosures, audit log, invitaciones)
- **Emisiones (`/emissions`)** — creación de inventario con año fiscal y **fuente de FE** (presets); entradas por alcance, categoría GHG, tCO₂e (manual o **cantidad × factor**)
- **Objetivos (`/targets`)** — altas con framework, curva y **palancas** (`levers` como claves)
- **Disclosures (`/disclosures`)** — altas TCFD/ESRS con IDs estándar; **edición de contenido** y estado
- **Configuración (`/settings`)** — formulario de organización, listado de equipo, invitaciones (registro en tabla; email Resend aún no cableado)
- **Dashboard** — KPIs por inventario, tendencia YoY, resumen de objetivos
- Migración **`20250423140000_rls_and_audit_triggers.sql`** — RLS multi-tenant y triggers que escriben en `audit_log_entries`. **Aplicar en el proyecto de Supabase** (CLI o SQL Editor) antes de producción
- **Catálogo `emission_factors`** (migraciones `20250424150000_emission_factors.sql` + `20250424150100_emission_factors_seed.sql`). 37 factores core (S1 combustibles + refrigerantes, S2 electricidad ES/UK/EU27, S3 travel + residuos + agua). RLS `select` abierto a autenticados; `activity_key` único → seed idempotente
- **Picker de factores en `/emissions`** + FK `emission_entries.factor_id` (migración `20250424160000_emission_entries_factor_fk.sql`). Modal con pills por scope, buscador, agrupación por categoría, preview live `quantity × ef_value / 1000`. Insert persiste `factor_id` + snapshot (`ef_value`, `ef_source`, `unit`, `category`, `subcategory`) para trazabilidad histórica
- Integración Resend (dependencia lista; flujo invitación pendiente)
- Deploy configurado en Vercel

### Hecho ✅ — v1.1 (defendible ante auditor)

> Las migraciones `20250425*` están **escritas pero pendientes de aplicar en Supabase remoto**. El código UI ya las espera; sin migración aplicada los inserts caen.

- **Tanda 1 — Data quality tiering (ESRS/CSRD)**
  - Migración `20250425120000_data_quality_tier.sql` añade `data_quality_tier smallint not null default 3 check (in 1,2,3)` y `data_quality_notes text` en `emission_entries` + índice `(inventory_id, data_quality_tier)`.
  - Tipo `DataQualityTier` y campos en `EmissionEntry`.
  - Modal de nueva entrada con selector tier (default 2 cuando se usa el picker), textarea de notas. Tabla del inventario muestra badge T1/T2/T3 con tooltip que incluye las notas.
  - Dashboard: bloque "Calidad del dato" con stacked bar weighted-by-tCO₂e (total + S1/S2/S3).
- **Tanda 2 — Scope 2 dual reporting**
  - Migración `20250425130000_scope2_method.sql`: columna `scope2_method` con check de valores, backfill `s2 → location_based`, constraint de consistencia (`scope='s2' ⇔ method not null`), índice parcial.
  - Migración `20250425130100_renewable_instruments.sql`: tabla con FK `organizations`, check `type in (GoO|REC|PPA|green_tariff)`, audit trigger via `app_user_org()`, RLS `for all` por org.
  - Migración `20250425130200_emission_factors_market_residual.sql`: 4 placeholders ES/UK/EU27 con `ef_value=0` + nota AIB (schema impide `null`). **Antes de demo real → actualizar con AIB Residual Mix vigente**.
  - Tipos `Scope2Method`, `RenewableInstrumentType`, `RenewableInstrument`. `EmissionEntry.scope2_method`.
  - Modal: bloque azul "Método Scope 2" sólo visible cuando `scope=s2`, tooltip pedagógico, aviso amber al elegir market-based.
  - Sub-página `/settings/renewable-energy` (server + client manager) con formulario en grid + tabla de instrumentos. Enlace desde `/settings`.
  - Dashboard: KPI de Alcance 2 reescrito como tarjeta dual (Location/Market). Total y trend YoY usan **location-based** como headline para evitar double-count. Banner pedagógico GHG Protocol Scope 2 Guidance con CTA cuando aún no hay entradas market-based.
- **Tanda 4 — Evidencia / attachments por entrada**
  - Migración `20250425140000_evidence_attachments.sql`: bucket privado `evidence` (idempotente), tabla con FK cascade a entries + FK `auth.users`, `storage_path` único, audit trigger que resuelve `org_id` vía `entries → inventories`, RLS de la tabla por org. **4 policies sobre `storage.objects`** con path-enforce: `(storage.foldername(name))[1] = app_user_org()::text`.
  - Tipo `EvidenceAttachment`. Server query de `/emissions` ampliada al embed `evidence_attachments(*)`.
  - Drawer client `attachments-drawer.tsx` con uploader (path `{org}/{entry}/{ts}-{safeFilename}`, sanitizado para Storage), descarga vía `createSignedUrl` TTL 60s y borrado seguro (blob primero, fila después).
  - Tabla de entradas con columna 📎 + contador.
- **Tanda 3 — Bulk import CSV (`/emissions/import`)**
  - Dependencia: `papaparse` 5.x + tipos (compat Next 16 / React 19 ✓, sin peer-deps React).
  - Server page carga inventarios + catálogo y los pasa al wizard cliente.
  - Wizard `import-wizard.tsx` (3 steps): descarga plantilla CSV (`Papa.unparse`), drop zone con drag-and-drop + file input, parse `Papa.parse` con `transformHeader` (lowercase/trim) y `skipEmptyLines: 'greedy'`.
  - Validación fila a fila vs catálogo: `inventory_year` lookup contra inventarios del org, `scope` ∈ s1/s2/s3, `activity_key` existe y `factor.scope` coincide, `quantity > 0`, `data_quality_tier` ∈ 1/2/3 (vacío → 3).
  - Preview con tabla coloreada (rojo si error). Botón "Importar N filas" → batch insert `from('emission_entries').insert([...])` con `factor_id` + snapshot + tier + `scope2_method='location_based'` por defecto en s2.
  - CTA "Importar CSV" añadido en cabecera de `/emissions`.
- **Tanda 5 — Removals / offsets / insets**
  - Migración `20250425150000_carbon_removals.sql`: tabla org-scoped con check `type in (REC|VCS|GoldStandard|PlanVivo|biochar|DAC|afforestation|other)`, FK cascade a `organizations`, `volume_tco2e >= 0`, audit trigger, RLS por `app_user_org()`.
  - Tipo `CarbonRemoval`, `CarbonRemovalType`.
  - Página `/removals` con `carbon-removals-manager` (alta + lista + borrado). Enlazada desde sidebar (icon `Sprout`).
  - Dashboard: nuevo bloque **Gross · Removals · Net** con las **tres líneas siempre visibles** (NO mostrar solo Net). Filtra removals al `inventory_year` del último inventario; nota auxiliar si hay removals de otros años. Dashboard fetch ampliado con `select('inventory_year, volume_tco2e').from('carbon_removals')`.
- **Tanda 6 — Conversión de unidades explícita**
  - Sin migración. Módulo `src/lib/emissions/unit-conversion.ts` con dos tablas: `GENERIC_CONVERSIONS` (t↔kg, MWh↔kWh, GWh↔kWh, L↔m³, m↔km) y `ACTIVITY_CONVERSIONS` por `activity_key` (gas natural m³→kWh PCS ×11.7 IDAE, densidades de gasolina/diesel/GLP/fuelóleo/gasóleo C). API: `findConversion`, `listCompatibleInputUnits`, `convertQuantity`. El reverso se computa con `1/factor` cuando aplica.
  - Modal `inventory-detail.tsx`: dropdown de unidad junto al input de cantidad (sólo si hay >1 unidad compatible). `useEffect` resetea `inputUnit` al cambiar el factor. Preview muestra dos líneas: la conversión (azul) y la fórmula final con la cantidad normalizada (zinc/emerald).
- **Tanda 7 — Breakdown actividad + Export CSV**
  - Dashboard: bloque "Dónde está el carbono" con top 5 categorías por tCO₂e, % del total y resto agregado. Filtra a S2 location-based para coherencia con el headline.
  - `InventoryDetail.handleExportCsv`: botón "Exportar CSV" descarga `inventario-{año}-{id}.csv` con columnas de trazabilidad completa (`activity_key`, `factor_year`, `factor_region`, `quantity_input`, `quantity_input_unit`, `conversion_factor`, snapshot, tier, scope2_method, notes). Usa `Papa.unparse` y JOIN con `emission_factors`.
- **Tanda 8 — Audit log UI (admin-only)**
  - Página `/admin/audit-log` server component con guard de rol admin (RLS + check defensivo).
  - Filtros vía URL params: `action` (ilike), `user`, `since`, `until`, `page`. Paginación 50 filas/página vía `range()` + `count: 'exact'`.
  - Mapeo `user_id → full_name/email` cargando los profiles del org. Payload con `<details>` (sin JS, HTML nativo).
  - Sidebar: link condicional "Audit log" sólo visible si `role==='admin'`. Layout pasa `role` al sidebar.
- **Tanda 9 — Trazabilidad explícita de conversión**
  - Migración `20250425160000_emission_entries_conversion_trace.sql` añade `quantity_input`, `quantity_input_unit`, `conversion_factor numeric not null default 1 check (>0)`. Backfill: para entradas históricas `quantity_input=quantity, quantity_input_unit=unit, conversion_factor=1`.
  - `EmissionEntry` tipo extendido con los 3 campos. Modal y CSV import populan los nuevos campos en cada insert (sin conversión → factor=1, input=quantity, input_unit=ef_unit). Export CSV los expone como columnas separadas. Las notas del analista vuelven a ser libres (la traza ya no se mete ahí).
- **Tanda 10 — Hardening RLS por rol**
  - Migración `20250425170000_rls_role_matrix.sql`. Helper `app_user_role()` (security definer, devuelve `role` desde `profiles` o NULL si bootstrap). Drop de todos los `for all` y split por operación (select/insert/update/delete). Matriz aplicada: admin (RWUD), analyst (RWU sobre inventarios/targets/disclosures, RWUD sobre entries/evidence/renewables/removals), client (R), auditor (R + audit log). Invitations admin-only. Organizations update admin-only. Profiles `update_self` + `update_admin`. `audit_log_entries` select admin/auditor.
  - **No rompe `org_insert_first`**: la bootstrap policy de 20250424120000 sigue en pie (un usuario nuevo aún no tiene profile, así que los predicados de rol no aplican y la creación inicial usa la policy de bootstrap).
- **Tanda 11 — Invitaciones email Resend**
  - Server actions en `src/lib/invitations/actions.ts`:
    - `sendInvitationEmail(invitationId)` — verifica caller admin de la org, llama a Resend con HTML inline y link `${NEXT_PUBLIC_APP_URL}/accept-invitation/${token}`.
    - `acceptInvitation(token)` — usa service role para evitar la nueva RLS admin-only de invitations. Verifica token, expiración, email match. Upsert en `profiles` (org+role) y `accepted=true`.
  - `InvitationManager` actualizado: genera `token = crypto.randomUUID()` y `expires_at = now + 7d`; tras el insert dispara la action de envío y muestra feedback ok/error. Botón "reenviar" por fila pendiente. Badge "Caducada" para invites expirados.
  - Página pública `/accept-invitation/[token]` (server) — fetcha la invitación vía service role (RLS de invitations es admin-only post-T10), valida estado, redirige a login si no hay sesión, llama a la action al hacer click. Componente `<Shell>` minimalista.
- **Cleanup migraciones legacy**
  - Borrados `20250424140000_emission_factors.sql` y `20250424141000_seed_emission_factors.sql` (schema legacy `DEFRA_2024_SIMPLIFIED` que NO está vivo en remoto). El esquema canónico es `20250424150000_emission_factors.sql` + `20250424150100_emission_factors_seed.sql`.

### Pendiente 🚧 — v1.1 (cierre)

- **Aplicar las migraciones `20250425*` en Supabase remoto** (CLI `supabase db push` o pegado en SQL Editor). **Orden importa.** Sin esto los inserts UI fallan.
  - `20250425120000_data_quality_tier.sql`
  - `20250425130000_scope2_method.sql`
  - `20250425130100_renewable_instruments.sql`
  - `20250425130200_emission_factors_market_residual.sql`
  - `20250425140000_evidence_attachments.sql`
  - `20250425150000_carbon_removals.sql`
  - `20250425160000_emission_entries_conversion_trace.sql`
  - `20250425170000_rls_role_matrix.sql`
- **Configurar variables de entorno para invitaciones por email** en `.env.local`:
  - `RESEND_API_KEY` — ya en plantilla.
  - `NEXT_PUBLIC_APP_URL` — debe coincidir con el dominio de producción (Vercel) o `http://localhost:3000` en dev. Sin esto los enlaces del email caen rotos.
  - Si quieres usar dominio propio en `from`, cambia `FROM_EMAIL` en `src/lib/invitations/actions.ts` (hoy `onboarding@resend.dev`, requiere verificar dominio en Resend).
- **Probar el flujo de invitaciones end-to-end** una vez aplicadas las migraciones (RLS de invitations ahora admin-only; el accept usa service role, así que necesita `SUPABASE_SERVICE_ROLE_KEY`).

### Pendiente 🚧 — post v1.1

- **Integración DEFRA API** (auto-refresh anual del catálogo desde la fuente). Necesita API key DEFRA + diseño de cache local.
- **Resiliencia e2e** — Playwright/CI/backups/monitoring. Scope semanas; queda como tanda dedicada.
- **Limpieza de blobs huérfanos** en Storage al borrar entries (trigger + edge function o purga UI).
- **Mapa de equivalencias scope2_method ↔ factor_market_residual** — hoy el modal no fuerza al analista a elegir `electricity_grid_*_market_residual` cuando marca market-based. Próximo refinement.
- **Materialización del breakdown** si el dataset crece: el cálculo es O(N) en cada render del dashboard.

### Fuera de v1.1 (no tocar en esta fase)

- **PCAF / financed emissions (cat 15)** → v1.3 o v2.
- **Base year + política de recálculo** → v1.2.
- **Materiality profiler por industria** → v1.2.
- **Scope 3 cat 11 (use of sold products)** → v2.
- **Consolidación multi-entity real** → v2.
- **XBRL tagging** → v2.
- **Integraciones ERP** → después.

### Riesgos / decisiones abiertas

- **Next.js 16 + React 19** — ecosistema joven. Antes de añadir deps, comprobar compatibilidad.
- **Tailwind 4** — sintaxis y pipeline cambian respecto a v3 (no hay `tailwind.config.*` clásico aquí).
- **Solape con `nfq-esg-reporting-suite`** — Carbon Intelligence = cálculo + targets; Reporting Suite = presentación regulatoria. Frontera confirmada (no fusión).
- **Placeholders catálogo market_residual** (`ef_value=0`) — usar sólo internamente hasta sustituir por AIB Residual Mix oficial. El schema fuerza `not null + >=0`, por eso 0 en vez de null.
- **Blobs huérfanos en Storage** al borrar una entry — la FK cascade limpia `evidence_attachments` pero los archivos físicos quedan. Limpieza diferida (trigger + edge function o purga UI) post v1.1.

---

## Cómo trabajar en este proyecto con Claude

- **Antes de tocar código:** releer `AGENTS.md` + la sección relevante de `node_modules/next/dist/docs/` (Next.js 16 tiene breaking changes respecto al conocimiento base).
- **Supabase:** usar `createClient` desde `lib/supabase/server.ts` en Server Components; desde `lib/supabase/client.ts` en Client Components. No mezclar.
- **Antes de cerrar una tarea:** `npm run build` (compila + lint) como smoke test mínimo.
- **No commitear ni desplegar** sin confirmación.
- **Secretos:** `.env.local` en `.gitignore`; no pegar keys en respuestas.
- **Al terminar sesión significativa:** actualizar §3 de este archivo.
