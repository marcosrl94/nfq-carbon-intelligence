-- ========================================================================
-- Seed inicial del catálogo de factores de emisión
-- ========================================================================
-- 37 factores core que cubren ~80% de casos midmarket ibérico:
--   · Scope 1 — combustibles (estacionarios + automoción) + refrigerantes
--   · Scope 2 — electricidad mix España + UK + EU27 medio
--   · Scope 3 — viajes de negocio, residuos básicos, agua
--
-- FUENTES:
--   · MITECO — Mix eléctrico España (Nota técnica / Factores de emisión)
--              https://www.miteco.gob.es/es/cambio-climatico/temas/mitigacion-politicas-y-medidas/factores_emision_tcm30-479095.aspx
--   · IDAE   — Combustibles España ("Factores de emisión CO2" IDAE)
--              https://www.idae.es/
--   · DEFRA  — UK Gov GHG reporting conversion factors 2024
--              https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024
--
-- ⚠️ VALORES REPRESENTATIVOS consistentes con las publicaciones comúnmente
--    citadas. Antes de usar en reporting real, VERIFICAR contra la edición
--    vigente del documento fuente. La idempotencia por activity_key permite
--    re-ejecutar el seed y actualizar filas manualmente sin romper UI.

insert into public.emission_factors
  (activity_key, scope, category, subcategory, activity_label, ef_value, ef_unit,
   source, source_version, year, region, citation_url, notes)
values
-- ── Scope 1 · Combustión estacionaria (IDAE) ──────────────────────────────
('fuel_natural_gas_es',        's1', 'Combustión estacionaria', 'Gas natural',              'Gas natural',                    0.20200, 'kWh PCS', 'IDAE', 'IDAE Factores 2023', 2023, 'ES', null, 'PCS = poder calorífico superior; verificar última edición IDAE.'),
('fuel_lpg_propane_es',        's1', 'Combustión estacionaria', 'GLP',                      'GLP / Propano',                  1.65000, 'L',       'IDAE', 'IDAE Factores 2023', 2023, 'ES', null, null),
('fuel_heating_oil_es',        's1', 'Combustión estacionaria', 'Gasóleo C',                'Gasóleo C (calefacción)',        2.68000, 'L',       'IDAE', 'IDAE Factores 2023', 2023, 'ES', null, null),
('fuel_fueloil_es',            's1', 'Combustión estacionaria', 'Fuelóleo',                 'Fuelóleo',                       3.17000, 'kg',      'IDAE', 'IDAE Factores 2023', 2023, 'ES', null, null),
('fuel_coal_es',               's1', 'Combustión estacionaria', 'Carbón',                   'Carbón (hulla nacional)',        2.34000, 'kg',      'IDAE', 'IDAE Factores 2023', 2023, 'ES', null, 'Valor medio; varía por tipo de carbón.'),
('fuel_biomass_pellet_es',     's1', 'Combustión estacionaria', 'Biomasa',                  'Biomasa — pellets madera',       0.02000, 'kg',      'IDAE', 'IDAE Factores 2023', 2023, 'ES', null, 'Emisiones biogénicas excluidas; valor CH4+N2O.'),

-- ── Scope 1 · Combustión móvil / automoción (IDAE) ────────────────────────
('fuel_gasoline_auto_es',      's1', 'Combustión móvil',        'Gasolina',                 'Gasolina 95 (automoción)',       2.38000, 'L',       'IDAE', 'IDAE Factores 2023', 2023, 'ES', null, null),
('fuel_diesel_auto_es',        's1', 'Combustión móvil',        'Gasóleo',                  'Gasóleo A (automoción)',         2.49000, 'L',       'IDAE', 'IDAE Factores 2023', 2023, 'ES', null, null),
('fuel_lpg_auto_es',           's1', 'Combustión móvil',        'GLP',                      'GLP automoción',                 1.66000, 'L',       'IDAE', 'IDAE Factores 2023', 2023, 'ES', null, null),

-- ── Scope 1 · Refrigerantes (DEFRA — GWP AR5) ─────────────────────────────
('refrigerant_r410a',          's1', 'Fugas fluorinados',       'R-410A',                   'Refrigerante R-410A (fuga)',     2088.00, 'kg',      'DEFRA','DEFRA 2024',         2024, 'GLOBAL', null, 'Valor = GWP100 AR5. Aplicar a fugas en kg.'),
('refrigerant_r134a',          's1', 'Fugas fluorinados',       'R-134a',                   'Refrigerante R-134a (fuga)',     1430.00, 'kg',      'DEFRA','DEFRA 2024',         2024, 'GLOBAL', null, 'Valor = GWP100 AR5.'),
('refrigerant_r32',            's1', 'Fugas fluorinados',       'R-32',                     'Refrigerante R-32 (fuga)',       675.000, 'kg',      'DEFRA','DEFRA 2024',         2024, 'GLOBAL', null, null),
('refrigerant_r404a',          's1', 'Fugas fluorinados',       'R-404A',                   'Refrigerante R-404A (fuga)',     3922.00, 'kg',      'DEFRA','DEFRA 2024',         2024, 'GLOBAL', null, null),

-- ── Scope 2 · Electricidad (MITECO España + DEFRA UK/EU) ──────────────────
('electricity_grid_es_2022',   's2', 'Electricidad',            'Mix España',               'Electricidad mix España 2022',   0.14600, 'kWh',     'MITECO','MITECO 2022 (pub. 2024)', 2022, 'ES',   null, 'Mix nacional comercializadoras sin etiqueta verde.'),
('electricity_grid_es_2023',   's2', 'Electricidad',            'Mix España',               'Electricidad mix España 2023',   0.11000, 'kWh',     'MITECO','MITECO 2023 (pub. 2024)', 2023, 'ES',   null, 'Baja respecto 2022 por mayor peso renovables.'),
('electricity_grid_uk_2024',   's2', 'Electricidad',            'Grid UK',                  'Electricidad grid UK 2024',      0.20705, 'kWh',     'DEFRA', 'DEFRA 2024',             2024, 'UK',   null, null),
('electricity_grid_eu27_avg',  's2', 'Electricidad',            'Media EU27',               'Electricidad EU27 (media)',      0.25100, 'kWh',     'DEFRA', 'DEFRA 2024 overseas',    2024, 'EU27', null, 'Usar sólo si no hay factor por país.'),

-- ── Scope 3 · Cat 6 Business travel (DEFRA) ───────────────────────────────
('travel_car_petrol_avg',      's3', 'Viajes de negocio',       'Coche — gasolina',         'Coche gasolina (medio)',         0.16955, 'vkm',     'DEFRA', 'DEFRA 2024',             2024, 'UK',   null, 'Vehicle-km (no pasajero).'),
('travel_car_diesel_avg',      's3', 'Viajes de negocio',       'Coche — diésel',           'Coche diésel (medio)',           0.16635, 'vkm',     'DEFRA', 'DEFRA 2024',             2024, 'UK',   null, null),
('travel_car_hybrid_avg',      's3', 'Viajes de negocio',       'Coche — híbrido',          'Coche híbrido (medio)',          0.11990, 'vkm',     'DEFRA', 'DEFRA 2024',             2024, 'UK',   null, null),
('travel_car_ev_avg',          's3', 'Viajes de negocio',       'Coche — eléctrico',        'Coche eléctrico (medio)',        0.04700, 'vkm',     'DEFRA', 'DEFRA 2024',             2024, 'UK',   null, 'Solo WTT + infraestructura; excluye electricidad consumida.'),
('travel_taxi_regular',        's3', 'Viajes de negocio',       'Taxi',                     'Taxi (regular)',                 0.20826, 'vkm',     'DEFRA', 'DEFRA 2024',             2024, 'UK',   null, null),
('travel_bus_local',           's3', 'Viajes de negocio',       'Autobús',                  'Autobús local',                  0.10241, 'pkm',     'DEFRA', 'DEFRA 2024',             2024, 'UK',   null, 'pkm = passenger-km.'),
('travel_rail_national',       's3', 'Viajes de negocio',       'Tren — nacional',          'Tren nacional',                  0.03549, 'pkm',     'DEFRA', 'DEFRA 2024',             2024, 'UK',   null, null),
('travel_rail_international',  's3', 'Viajes de negocio',       'Tren — internacional',     'Tren internacional',             0.00454, 'pkm',     'DEFRA', 'DEFRA 2024',             2024, 'EU',   null, 'Eurostar / tren alta velocidad EU.'),
('travel_flight_domestic',     's3', 'Viajes de negocio',       'Vuelo — doméstico',        'Vuelo doméstico economy',        0.24621, 'pkm',     'DEFRA', 'DEFRA 2024',             2024, 'GLOBAL', null, 'Aplicar uplift RF 1.9× si se reporta con radiative forcing.'),
('travel_flight_short_eco',    's3', 'Viajes de negocio',       'Vuelo — corta economy',    'Vuelo corta distancia economy',  0.15102, 'pkm',     'DEFRA', 'DEFRA 2024',             2024, 'GLOBAL', null, 'Corta <3700 km.'),
('travel_flight_long_eco',     's3', 'Viajes de negocio',       'Vuelo — larga economy',    'Vuelo larga distancia economy',  0.19085, 'pkm',     'DEFRA', 'DEFRA 2024',             2024, 'GLOBAL', null, 'Larga >=3700 km.'),
('travel_flight_long_business','s3', 'Viajes de negocio',       'Vuelo — larga business',   'Vuelo larga distancia business', 0.55347, 'pkm',     'DEFRA', 'DEFRA 2024',             2024, 'GLOBAL', null, null),
('travel_hotel_night_es',      's3', 'Viajes de negocio',       'Hotel — España',           'Hotel (noche) — España',         17.0000, 'night',   'DEFRA', 'DEFRA 2024',             2024, 'ES',   null, 'Media DEFRA país; verificar tier.'),

-- ── Scope 3 · Cat 5 Waste (DEFRA) ─────────────────────────────────────────
('waste_municipal_landfill',   's3', 'Residuos',                'Vertedero',                'Residuos municipales a vertedero',0.46710,'kg',     'DEFRA', 'DEFRA 2024',             2024, 'UK',   null, 'Mixed municipal waste.'),
('waste_paper_recycled',       's3', 'Residuos',                'Reciclaje papel',          'Papel/cartón reciclado',         0.02110, 'kg',     'DEFRA', 'DEFRA 2024',             2024, 'UK',   null, null),
('waste_plastic_recycled',     's3', 'Residuos',                'Reciclaje plástico',       'Plástico reciclado',             0.02110, 'kg',     'DEFRA', 'DEFRA 2024',             2024, 'UK',   null, null),
('waste_glass_recycled',       's3', 'Residuos',                'Reciclaje vidrio',         'Vidrio reciclado',               0.02110, 'kg',     'DEFRA', 'DEFRA 2024',             2024, 'UK',   null, null),
('waste_organic_composted',    's3', 'Residuos',                'Compostaje',               'Residuo orgánico compostado',    0.01040, 'kg',     'DEFRA', 'DEFRA 2024',             2024, 'UK',   null, null),

-- ── Scope 3 · Cat 4 Agua (DEFRA) ──────────────────────────────────────────
('water_supply',               's3', 'Agua',                    'Suministro',               'Agua de suministro',             0.17700, 'm3',     'DEFRA', 'DEFRA 2024',             2024, 'UK',   null, null),
('water_treatment',            's3', 'Agua',                    'Tratamiento',              'Tratamiento aguas residuales',   0.27200, 'm3',     'DEFRA', 'DEFRA 2024',             2024, 'UK',   null, null)

on conflict (activity_key) do nothing;
