-- ========================================================================
-- Catálogo: factores residual mix (market-based) — placeholders
-- ========================================================================
-- GHG Protocol Scope 2 Guidance market-based requiere un "residual mix"
-- cuando la organización no tiene instrumento contractual asignado al
-- consumo. AIB publica el residual mix por país; aquí sembramos los
-- placeholders para ES / UK / EU27 con ef_value=0 + nota explícita.
--
-- ⚠️ ef_value=0 es un PLACEHOLDER. Antes de usar en reporting real:
--    actualizar con el último residual mix AIB publicado para el año
--    correspondiente (https://www.aib-net.org/facts/european-residual-mix).
--    El esquema impone ef_value >= 0 (not null), por eso 0 en lugar de null.
--
-- activity_key sigue la convención <original>_market_residual para que
-- el picker pueda asociarlos al factor location-based equivalente.

insert into public.emission_factors
  (activity_key, scope, category, subcategory, activity_label, ef_value, ef_unit,
   source, source_version, year, region, citation_url, notes)
values
('electricity_grid_es_2022_market_residual', 's2', 'Electricidad', 'Mix España (residual)',  'Electricidad mix España 2022 — market-based residual', 0, 'kWh', 'MITECO', 'AIB Residual Mix (placeholder)',  2022, 'ES',   'https://www.aib-net.org/facts/european-residual-mix', 'PLACEHOLDER — actualizar con AIB Residual Mix ES 2022 antes de reporting.'),
('electricity_grid_es_2023_market_residual', 's2', 'Electricidad', 'Mix España (residual)',  'Electricidad mix España 2023 — market-based residual', 0, 'kWh', 'MITECO', 'AIB Residual Mix (placeholder)',  2023, 'ES',   'https://www.aib-net.org/facts/european-residual-mix', 'PLACEHOLDER — actualizar con AIB Residual Mix ES 2023 antes de reporting.'),
('electricity_grid_uk_2024_market_residual',  's2', 'Electricidad', 'Grid UK (residual)',     'Electricidad grid UK 2024 — market-based residual',    0, 'kWh', 'DEFRA',  'AIB Residual Mix (placeholder)',  2024, 'UK',   'https://www.aib-net.org/facts/european-residual-mix', 'PLACEHOLDER — actualizar con AIB Residual Mix UK 2024.'),
('electricity_grid_eu27_avg_market_residual', 's2', 'Electricidad', 'Media EU27 (residual)',  'Electricidad EU27 (media) — market-based residual',    0, 'kWh', 'DEFRA',  'AIB Residual Mix (placeholder)',  2024, 'EU27', 'https://www.aib-net.org/facts/european-residual-mix', 'PLACEHOLDER — usar sólo si no hay residual mix por país.')
on conflict (activity_key) do nothing;
