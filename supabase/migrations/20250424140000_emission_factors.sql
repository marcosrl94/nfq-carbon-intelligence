-- Catálogo de factores de emisión (EF) consultable por todos los usuarios autenticados.
-- Se alimenta con un seed DEFRA 2024 simplificado en la migración 20250424141000.
-- Diseño:
--   * ef_value en kgCO2e por 1 unidad base (unit). Para pasar a tCO2e: quantity * ef_value / 1000.
--   * (source, scope, subcategory, unit, region, year) es la clave natural — evitamos duplicados.
--   * region usa ISO-3166 alpha-2 ('ES', 'GB', 'FR'…) o 'GLOBAL' cuando no depende del país.

create table if not exists public.emission_factors (
  id uuid primary key default gen_random_uuid(),
  source text not null,                 -- 'DEFRA_2024_SIMPLIFIED', 'IDAE_2024', …
  scope text not null check (scope in ('s1', 's2', 's3')),
  category text not null,               -- agrupación GHG Protocol ("Combustión estacionaria", "Viajes de negocio"…)
  subcategory text not null,            -- actividad específica ("Gas natural", "Vuelo largo recorrido clase turista"…)
  activity_label text not null,         -- etiqueta humana en el selector (ES)
  unit text not null,                   -- 'kWh', 'L', 'km', 'pax-km', 't', 't-km', 'm3', 'room-night', 'kg'
  ef_value numeric(14, 6) not null,     -- kgCO2e por 1 unidad
  ef_unit text not null default 'kgCO2e',
  region text not null default 'GLOBAL',-- ISO-3166 alpha-2 o 'GLOBAL'
  year int not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint emission_factors_natural_key unique (source, scope, subcategory, unit, region, year)
);

comment on table public.emission_factors is 'Catálogo de factores de emisión (read-only desde la app). Curated subset.';
comment on column public.emission_factors.ef_value is 'kgCO2e por 1 unidad base (multiplicar por quantity y dividir entre 1000 para tCO2e).';

create index if not exists emission_factors_scope_category_idx
  on public.emission_factors (scope, category);

create index if not exists emission_factors_source_year_idx
  on public.emission_factors (source, year);

-- RLS: lectura para cualquier usuario autenticado. Sin escritura desde la app (seed via migración).
alter table public.emission_factors enable row level security;

drop policy if exists "emission_factors_read_all" on public.emission_factors;
create policy "emission_factors_read_all" on public.emission_factors
  for select
  to authenticated
  using (true);

-- Link opcional desde emission_entries al factor usado, para trazabilidad.
-- Mantenemos ef_value y ef_source como snapshots (por si el factor cambia en el tiempo).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'emission_entries' and column_name = 'factor_id'
  ) then
    alter table public.emission_entries add column factor_id uuid
      references public.emission_factors(id) on delete set null;
    create index if not exists emission_entries_factor_id_idx on public.emission_entries (factor_id);
  end if;
end $$;
