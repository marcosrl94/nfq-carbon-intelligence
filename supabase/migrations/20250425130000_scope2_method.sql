-- ========================================================================
-- emission_entries.scope2_method  (GHG Protocol Scope 2 Dual Reporting)
-- ========================================================================
-- GHG Protocol Scope 2 Guidance exige reportar electricidad bajo ambos
-- métodos:
--   · location_based — factor del mix de la red (MITECO / DEFRA grid)
--   · market_based   — factor contractual (GoOs / RECs / PPAs / green tariff;
--                      o residual mix si no hay instrumentos)
--
-- Esta columna sólo aplica cuando scope='s2'. Para s1/s3 debe quedar null.
-- Backfill: las entradas s2 históricas se reclasifican a 'location_based'
-- (lo que de facto se estaba reportando antes de v1.1).

alter table public.emission_entries
  add column if not exists scope2_method text;

-- Sólo permite los dos valores válidos cuando esté presente
alter table public.emission_entries
  drop constraint if exists emission_entries_scope2_method_values;
alter table public.emission_entries
  add constraint emission_entries_scope2_method_values
    check (scope2_method is null or scope2_method in ('location_based', 'market_based'));

-- Backfill antes del check de consistencia: todo s2 previo era location-based
update public.emission_entries
   set scope2_method = 'location_based'
 where scope = 's2' and scope2_method is null;

-- Consistencia: scope='s2' ⇔ scope2_method not null (s1/s3 → null)
alter table public.emission_entries
  drop constraint if exists emission_entries_scope2_method_consistency;
alter table public.emission_entries
  add constraint emission_entries_scope2_method_consistency
    check (
      (scope =  's2' and scope2_method is not null)
      or
      (scope <> 's2' and scope2_method is null)
    );

create index if not exists idx_emission_entries_scope2_method
  on public.emission_entries(inventory_id, scope2_method)
  where scope = 's2';

comment on column public.emission_entries.scope2_method is
  'GHG Protocol Scope 2 dual reporting. Sólo aplica cuando scope=s2. Valores: location_based (mix grid) | market_based (contractual / residual mix).';
