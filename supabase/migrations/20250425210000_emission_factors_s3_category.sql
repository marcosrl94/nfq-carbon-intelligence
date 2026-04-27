-- ========================================================================
-- v1.2.1 — emission_factors.s3_category (mapping a GHG Protocol cats 1–15)
-- ========================================================================
-- Asocia cada factor s3 a su categoría 1–15 GHG Protocol Scope 3 Standard.
-- Permite hotspot detection granular en /materiality (antes evaluaba S3
-- en agregado; ahora podemos decir "te falta cat 6 business travel"
-- vs "te falta cat 1 purchased goods" cuando ambas están marcadas como
-- material).
--
-- Convención GHG Protocol Scope 3 Standard:
--    1  Purchased goods and services
--    2  Capital goods
--    3  Fuel- and energy-related activities (not in S1/S2) — WTT
--    4  Upstream transportation and distribution
--    5  Waste generated in operations
--    6  Business travel
--    7  Employee commuting
--    8  Upstream leased assets
--    9  Downstream transportation and distribution
--   10  Processing of sold products
--   11  Use of sold products
--   12  End-of-life treatment of sold products
--   13  Downstream leased assets
--   14  Franchises
--   15  Investments (financed emissions / PCAF)

alter table public.emission_factors
  add column if not exists s3_category smallint
    check (s3_category is null or (s3_category between 1 and 15));

comment on column public.emission_factors.s3_category is
  'Categoría GHG Protocol Scope 3 (1-15). Sólo aplica cuando scope=s3. Permite hotspot detection granular en /materiality.';

-- ── Backfill de los 20 factores S3 actuales ─────────────────────────────
-- Cat 6: business travel (todos los travel_*: coche, taxi, bus, tren, vuelos, hotel)
update public.emission_factors
   set s3_category = 6
 where scope = 's3'
   and (activity_key like 'travel_%' or category = 'Viajes de negocio');

-- Cat 5: waste in operations (waste_*: vertedero, reciclaje papel/plástico/vidrio, compostaje)
update public.emission_factors
   set s3_category = 5
 where scope = 's3'
   and (activity_key like 'waste_%' or category = 'Residuos');

-- Cat 1: purchased goods — water_supply es agua comprada
update public.emission_factors
   set s3_category = 1
 where scope = 's3' and activity_key = 'water_supply';

-- Cat 5: water_treatment va a "Waste generated in operations" (aguas residuales)
update public.emission_factors
   set s3_category = 5
 where scope = 's3' and activity_key = 'water_treatment';

-- Índice para queries por categoría (usado en /materiality)
create index if not exists idx_ef_s3_category
  on public.emission_factors(s3_category)
  where s3_category is not null;
