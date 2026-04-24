-- ========================================================================
-- emission_entries.factor_id → emission_factors.id (FK opcional)
-- ========================================================================
-- Conecta cada entrada del inventario con el factor del catálogo que se
-- usó para calcularla. No es NOT NULL para compatibilidad con entradas
-- históricas / manuales sin factor de catálogo.
--
-- La trazabilidad completa también se guarda en `ef_value` + `ef_source`
-- como snapshot: aunque más adelante actualicemos el factor en el catálogo,
-- la entrada histórica conserva el valor con el que fue calculada.
--
-- ON DELETE SET NULL: si alguien borra el factor del catálogo, la entrada
-- sigue existiendo con su snapshot y pierde solo la referencia viva.

alter table public.emission_entries
  add column if not exists factor_id uuid references public.emission_factors(id) on delete set null;

create index if not exists idx_emission_entries_factor
  on public.emission_entries(factor_id)
  where factor_id is not null;

comment on column public.emission_entries.factor_id is
  'FK opcional al catálogo de factores. Para trazabilidad histórica usar también ef_value/ef_source (snapshot en el momento del cálculo).';
