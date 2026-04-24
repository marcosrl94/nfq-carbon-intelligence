-- ========================================================================
-- Catálogo de factores de emisión (emission_factors)
-- ========================================================================
-- Spine del módulo "carbon que funciona": en vez de que el analista escriba
-- el factor a mano en cada emission_entry, elige una actividad del catálogo
-- y el sistema calcula tCO2e con trazabilidad a la fuente.
--
-- Sources soportadas: MITECO, IDAE, DEFRA.
--
-- Semántica de factor:
--   tCO2e = quantity * ef_value / 1000
--   · ef_value está en  kgCO2e / 1 unidad(ef_unit)
--   · unit = 'kgCO2e' (dimensión del numerador de ef_value; se deja para claridad)
--   · ef_unit = unidad del denominador (kWh, L, km, kg, m3, pkm, vkm…)
--
-- RLS: SELECT abierto a usuarios autenticados. La edición se hace vía SQL /
-- service role hasta que haya admin UI.

create table if not exists public.emission_factors (
  id uuid primary key default gen_random_uuid(),

  -- Clave estable para seed idempotente y referencias programáticas
  activity_key text not null unique,

  -- Taxonomía GHG
  scope text not null check (scope in ('s1', 's2', 's3')),
  category text not null,                     -- ej: 'Combustión estacionaria', 'Electricidad'
  subcategory text,                           -- ej: 'Gas natural', 'Mix eléctrico nacional'
  activity_label text not null,               -- lo que verá el usuario en el picker

  -- Factor
  unit text not null default 'kgCO2e',        -- numerador (por claridad)
  ef_value numeric not null check (ef_value >= 0),
  ef_unit text not null,                      -- denominador (kWh, L, km…)

  -- Metadatos de fuente (imprescindibles para auditoría)
  source text not null check (source in ('MITECO', 'IDAE', 'DEFRA')),
  source_version text,                        -- ej: 'DEFRA 2024 v1.0', 'IDAE Factores 2023'
  year int not null check (year between 1990 and 2100),
  region text not null,                       -- 'ES', 'UK', 'EU27', 'GLOBAL'
  citation_url text,

  -- Observaciones + housekeeping
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.emission_factors is
  'Catálogo de factores de emisión (MITECO/IDAE/DEFRA). Consumido por emission_entries para calcular tCO2e con trazabilidad.';

-- Índices útiles para el picker en /emissions
create index if not exists idx_ef_scope   on public.emission_factors(scope)  where is_active;
create index if not exists idx_ef_source  on public.emission_factors(source) where is_active;
create index if not exists idx_ef_region  on public.emission_factors(region) where is_active;
create index if not exists idx_ef_key     on public.emission_factors(activity_key);

-- Trigger genérico para updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ef_updated_at on public.emission_factors;
create trigger trg_ef_updated_at
  before update on public.emission_factors
  for each row execute function public.set_updated_at();

-- RLS
alter table public.emission_factors enable row level security;

drop policy if exists "ef_read_authenticated" on public.emission_factors;
create policy "ef_read_authenticated" on public.emission_factors
  for select using (auth.uid() is not null);
