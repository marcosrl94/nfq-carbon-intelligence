-- Seed DEFRA 2024 simplified — subset curado representativo de ~36 factores.
-- IMPORTANTE: estos valores son aproximados y pensados para demo / POC. Para producción:
--   * Sustituir por los valores oficiales DEFRA del año contable que corresponda
--   * Añadir factores específicos del cliente (p.ej. mix eléctrico real del proveedor)
--   * Renovar anualmente (crear una nueva source tipo 'DEFRA_2025_SIMPLIFIED' sin pisar los previos)
--
-- Referencia original: UK Government GHG Conversion Factors for Company Reporting (DEFRA/BEIS)

-- on conflict: si ya existe (source, scope, subcategory, unit, region, year), no dupliques.
insert into public.emission_factors
  (source, scope, category, subcategory, activity_label, unit, ef_value, region, year, notes)
values
  -- ——— SCOPE 1 · Combustión estacionaria ———
  ('DEFRA_2024_SIMPLIFIED', 's1', 'Combustión estacionaria', 'Gas natural', 'Gas natural (calefacción/proceso)', 'kWh', 0.18290, 'GLOBAL', 2024, 'Poder calorífico bruto (gross CV)'),
  ('DEFRA_2024_SIMPLIFIED', 's1', 'Combustión estacionaria', 'GLP', 'GLP / propano (calefacción)', 'L', 1.55708, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's1', 'Combustión estacionaria', 'Gasoil calefacción', 'Gasoil de calefacción', 'L', 2.54169, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's1', 'Combustión estacionaria', 'Carbón industrial', 'Carbón industrial', 't', 2425.00000, 'GLOBAL', 2024, null),

  -- ——— SCOPE 1 · Combustión móvil (flota propia) ———
  ('DEFRA_2024_SIMPLIFIED', 's1', 'Combustión móvil', 'Diésel', 'Diésel (flota propia, L consumidos)', 'L', 2.54603, 'GLOBAL', 2024, 'Media con biocombustible'),
  ('DEFRA_2024_SIMPLIFIED', 's1', 'Combustión móvil', 'Gasolina', 'Gasolina (flota propia, L consumidos)', 'L', 2.16985, 'GLOBAL', 2024, 'Media con biocombustible'),
  ('DEFRA_2024_SIMPLIFIED', 's1', 'Combustión móvil', 'Coche diésel', 'Coche empresa diésel (km recorridos)', 'km', 0.16844, 'GLOBAL', 2024, 'Segmento medio'),
  ('DEFRA_2024_SIMPLIFIED', 's1', 'Combustión móvil', 'Coche gasolina', 'Coche empresa gasolina (km recorridos)', 'km', 0.16454, 'GLOBAL', 2024, 'Segmento medio'),
  ('DEFRA_2024_SIMPLIFIED', 's1', 'Combustión móvil', 'Coche eléctrico', 'Coche empresa eléctrico (km, WTT+TTW)', 'km', 0.04693, 'GLOBAL', 2024, 'Incluye emisiones asociadas a generación eléctrica'),

  -- ——— SCOPE 1 · Emisiones fugitivas ———
  ('DEFRA_2024_SIMPLIFIED', 's1', 'Emisiones fugitivas', 'R-410A', 'Refrigerante R-410A (fugas)', 'kg', 2088.00000, 'GLOBAL', 2024, 'GWP AR5 100 años'),
  ('DEFRA_2024_SIMPLIFIED', 's1', 'Emisiones fugitivas', 'R-134a', 'Refrigerante R-134a (fugas)', 'kg', 1430.00000, 'GLOBAL', 2024, 'GWP AR5 100 años'),

  -- ——— SCOPE 2 · Electricidad comprada (location-based) ———
  ('DEFRA_2024_SIMPLIFIED', 's2', 'Electricidad comprada', 'Electricidad ES', 'Electricidad red España', 'kWh', 0.17200, 'ES', 2024, 'Mix REE 2023 aproximado'),
  ('DEFRA_2024_SIMPLIFIED', 's2', 'Electricidad comprada', 'Electricidad UK', 'Electricidad red Reino Unido', 'kWh', 0.20493, 'GB', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's2', 'Electricidad comprada', 'Electricidad EU-27', 'Electricidad media UE-27', 'kWh', 0.23100, 'EU', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's2', 'Electricidad comprada', 'Electricidad FR', 'Electricidad red Francia', 'kWh', 0.05600, 'FR', 2024, 'Predominio nuclear'),
  ('DEFRA_2024_SIMPLIFIED', 's2', 'Electricidad comprada', 'Electricidad DE', 'Electricidad red Alemania', 'kWh', 0.38000, 'DE', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's2', 'Electricidad comprada', 'Electricidad US', 'Electricidad media Estados Unidos', 'kWh', 0.38600, 'US', 2024, null),

  -- ——— SCOPE 2 · Calor/frío de red ———
  ('DEFRA_2024_SIMPLIFIED', 's2', 'Calor/vapor comprado', 'Calor de red', 'Calor de red urbano (district heating)', 'kWh', 0.17066, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's2', 'Calor/vapor comprado', 'Frío de red', 'Frío de red urbano (district cooling)', 'kWh', 0.54637, 'GLOBAL', 2024, null),

  -- ——— SCOPE 3 · Cat. 6 Viajes de negocio ———
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Viajes de negocios', 'Vuelo corto turista', 'Vuelo corto recorrido (<463 km) clase turista', 'pax-km', 0.15102, 'GLOBAL', 2024, 'Doméstico'),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Viajes de negocios', 'Vuelo medio turista', 'Vuelo medio recorrido (463-3700 km) clase turista', 'pax-km', 0.11954, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Viajes de negocios', 'Vuelo largo turista', 'Vuelo largo recorrido (>3700 km) clase turista', 'pax-km', 0.14981, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Viajes de negocios', 'Vuelo largo business', 'Vuelo largo recorrido clase business', 'pax-km', 0.43444, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Viajes de negocios', 'Tren', 'Tren nacional (media/alta velocidad)', 'pax-km', 0.03547, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Viajes de negocios', 'Taxi', 'Taxi urbano', 'pax-km', 0.15210, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Viajes de negocios', 'Hotel', 'Noche de hotel (media EU)', 'room-night', 10.40000, 'EU', 2024, 'Por habitación-noche'),

  -- ——— SCOPE 3 · Cat. 7 Desplazamiento empleados ———
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Desplazamiento empleados', 'Coche privado', 'Coche particular (media combustibles)', 'km', 0.17200, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Desplazamiento empleados', 'Autobús', 'Autobús urbano', 'pax-km', 0.10441, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Desplazamiento empleados', 'Tren cercanías', 'Tren de cercanías', 'pax-km', 0.03547, 'GLOBAL', 2024, null),

  -- ——— SCOPE 3 · Cat. 5 Residuos operacionales ———
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Residuos', 'Vertedero', 'Residuos generales a vertedero', 't', 467.00000, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Residuos', 'Reciclaje', 'Residuos reciclados', 't', 21.30000, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Residuos', 'Compostaje', 'Residuos orgánicos a compostaje', 't', 9.60000, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Residuos', 'Incineración', 'Residuos a incineración con recuperación energética', 't', 21.30000, 'GLOBAL', 2024, null),

  -- ——— SCOPE 3 · Agua y consumibles ———
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Bienes y servicios comprados', 'Agua suministro', 'Agua potable suministrada', 'm3', 0.34400, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Bienes y servicios comprados', 'Agua tratamiento', 'Agua residual tratada', 'm3', 0.27200, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Bienes y servicios comprados', 'Papel virgen', 'Papel (fibra virgen)', 't', 813.00000, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Bienes y servicios comprados', 'Papel reciclado', 'Papel (fibra reciclada)', 't', 705.00000, 'GLOBAL', 2024, null),

  -- ——— SCOPE 3 · Cat. 4 Transporte upstream ———
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Transporte upstream', 'Camión HGV', 'Camión pesado media (HGV, por t·km)', 't-km', 0.10749, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Transporte upstream', 'Tren mercancías', 'Tren mercancías (por t·km)', 't-km', 0.02812, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Transporte upstream', 'Barco contenedor', 'Barco contenedor (por t·km)', 't-km', 0.01614, 'GLOBAL', 2024, null),
  ('DEFRA_2024_SIMPLIFIED', 's3', 'Transporte upstream', 'Avión carga', 'Avión de carga (por t·km)', 't-km', 0.59700, 'GLOBAL', 2024, null)
on conflict (source, scope, subcategory, unit, region, year) do nothing;
