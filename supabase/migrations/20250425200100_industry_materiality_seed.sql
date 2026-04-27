-- ========================================================================
-- v1.2 Tanda C — seed NACE + industry_materiality
-- ========================================================================
-- NACE Rev 2.1: 21 secciones (A–U) + 30 divisiones representativas para
-- midmarket. Materialidad sembrada a nivel de sección con overrides en
-- divisiones clave (refino, cemento, alimentación, etc.).
--
-- Niveles: 0=no material · 1=potencial · 2=material · 3=alta materialidad
-- Categorías sembradas: s1, s2 + S3 cat1, cat3, cat4, cat5, cat6, cat7,
--                       cat11, cat15.
-- Fuentes: EFRAG ESRS sector standards drafts + SASB Materiality Map +
-- criterio interno NFQ. PLACEHOLDER — verificar con cliente y/o auditor.

-- ── 1. Secciones NACE ────────────────────────────────────────────────────
insert into public.nace_sectors (code, level, parent_code, label_es, label_en) values
('A', 'section', null, 'Agricultura, ganadería, silvicultura y pesca', 'Agriculture, forestry and fishing'),
('B', 'section', null, 'Industrias extractivas', 'Mining and quarrying'),
('C', 'section', null, 'Industria manufacturera', 'Manufacturing'),
('D', 'section', null, 'Suministro de energía eléctrica, gas, vapor y aire acondicionado', 'Electricity, gas, steam and air conditioning supply'),
('E', 'section', null, 'Suministro de agua, saneamiento, gestión de residuos y descontaminación', 'Water supply; sewerage, waste management and remediation'),
('F', 'section', null, 'Construcción', 'Construction'),
('G', 'section', null, 'Comercio al por mayor y al por menor', 'Wholesale and retail trade'),
('H', 'section', null, 'Transporte y almacenamiento', 'Transportation and storage'),
('I', 'section', null, 'Hostelería', 'Accommodation and food service activities'),
('J', 'section', null, 'Información y comunicaciones', 'Information and communication'),
('K', 'section', null, 'Actividades financieras y de seguros', 'Financial and insurance activities'),
('L', 'section', null, 'Actividades inmobiliarias', 'Real estate activities'),
('M', 'section', null, 'Actividades profesionales, científicas y técnicas', 'Professional, scientific and technical activities'),
('N', 'section', null, 'Actividades administrativas y servicios auxiliares', 'Administrative and support service activities'),
('O', 'section', null, 'Administración pública y defensa', 'Public administration and defence'),
('P', 'section', null, 'Educación', 'Education'),
('Q', 'section', null, 'Actividades sanitarias y de servicios sociales', 'Human health and social work activities'),
('R', 'section', null, 'Actividades artísticas, recreativas y de entretenimiento', 'Arts, entertainment and recreation'),
('S', 'section', null, 'Otros servicios', 'Other service activities'),
('T', 'section', null, 'Actividades de los hogares como empleadores', 'Activities of households as employers'),
('U', 'section', null, 'Actividades de organizaciones extraterritoriales', 'Activities of extraterritorial organisations')
on conflict (code) do nothing;

-- ── 2. Divisiones representativas (subset) ───────────────────────────────
insert into public.nace_sectors (code, level, parent_code, label_es, label_en) values
('A.01', 'division', 'A', 'Cultivos y producción ganadera', 'Crop and animal production'),
('A.02', 'division', 'A', 'Silvicultura y explotación forestal', 'Forestry and logging'),
('B.05', 'division', 'B', 'Extracción de carbón', 'Mining of coal and lignite'),
('B.06', 'division', 'B', 'Extracción de petróleo y gas natural', 'Extraction of crude petroleum and natural gas'),
('B.07', 'division', 'B', 'Extracción de minerales metálicos', 'Mining of metal ores'),
('C.10', 'division', 'C', 'Industria de la alimentación', 'Manufacture of food products'),
('C.11', 'division', 'C', 'Fabricación de bebidas', 'Manufacture of beverages'),
('C.13', 'division', 'C', 'Industria textil', 'Manufacture of textiles'),
('C.17', 'division', 'C', 'Industria del papel', 'Manufacture of paper and paper products'),
('C.19', 'division', 'C', 'Refino de petróleo', 'Manufacture of coke and refined petroleum products'),
('C.20', 'division', 'C', 'Industria química', 'Manufacture of chemicals'),
('C.23', 'division', 'C', 'Productos minerales no metálicos (cemento, vidrio)', 'Other non-metallic mineral products (cement, glass)'),
('C.24', 'division', 'C', 'Metalurgia (acero, aluminio)', 'Manufacture of basic metals'),
('C.27', 'division', 'C', 'Material y equipo eléctrico', 'Manufacture of electrical equipment'),
('C.29', 'division', 'C', 'Vehículos de motor', 'Manufacture of motor vehicles'),
('D.35', 'division', 'D', 'Suministro de energía eléctrica, gas, vapor', 'Electricity, gas, steam supply'),
('E.36', 'division', 'E', 'Captación, depuración y distribución de agua', 'Water collection, treatment and supply'),
('E.38', 'division', 'E', 'Recogida, tratamiento y eliminación de residuos', 'Waste collection, treatment and disposal'),
('F.41', 'division', 'F', 'Construcción de edificios', 'Construction of buildings'),
('F.42', 'division', 'F', 'Ingeniería civil', 'Civil engineering'),
('G.47', 'division', 'G', 'Comercio al por menor', 'Retail trade'),
('H.49', 'division', 'H', 'Transporte terrestre', 'Land transport'),
('H.51', 'division', 'H', 'Transporte aéreo', 'Air transport'),
('I.55', 'division', 'I', 'Servicios de alojamiento', 'Accommodation'),
('J.62', 'division', 'J', 'Programación, consultoría informática', 'Computer programming and consultancy'),
('J.63', 'division', 'J', 'Servicios de información (data centers, hosting)', 'Information service activities (data centers)'),
('K.64', 'division', 'K', 'Servicios financieros (banca)', 'Financial service activities (banking)'),
('K.65', 'division', 'K', 'Seguros y fondos de pensiones', 'Insurance and pension funding'),
('L.68', 'division', 'L', 'Actividades inmobiliarias', 'Real estate activities'),
('M.70', 'division', 'M', 'Consultoría de gestión', 'Management consultancy activities'),
('Q.86', 'division', 'Q', 'Actividades sanitarias', 'Human health activities')
on conflict (code) do nothing;

-- ── 3. Industry materiality — nivel sección ─────────────────────────────
-- Convención: por cada sección sembramos las 10 categorías clave.
-- Lo hacemos con un do block para legibilidad.

insert into public.industry_materiality (sector_code, scope_category, materiality, source_framework, notes) values
-- A · Agricultura, ganadería, silvicultura y pesca
('A','s1',3,'EFRAG_ESRS','Emisiones directas: CH4 ganado, N2O fertilizantes'),
('A','s2',2,'EFRAG_ESRS','Bombeo, climatización, ordeño'),
('A','s3.cat1',2,'SASB','Compras de pienso, fertilizantes, semillas'),
('A','s3.cat3',1,'NFQ_internal','WTT combustibles agrícolas'),
('A','s3.cat4',2,'EFRAG_ESRS','Logística productos perecederos'),
('A','s3.cat5',2,'NFQ_internal','Residuos agrícolas, lodos'),
('A','s3.cat6',1,'NFQ_internal',null),
('A','s3.cat7',1,'NFQ_internal',null),
('A','s3.cat11',2,'EFRAG_ESRS','Emisiones de uso de productos (depende cadena)'),
('A','s3.cat15',0,'NFQ_internal','No aplica'),

-- B · Industrias extractivas
('B','s1',3,'EFRAG_ESRS','Combustión + venting/flaring + fugitive methane'),
('B','s2',3,'SASB','Alta intensidad eléctrica (procesos)'),
('B','s3.cat1',2,'SASB','Equipos pesados, químicos auxiliares'),
('B','s3.cat3',2,'NFQ_internal','WTT diésel'),
('B','s3.cat4',2,'NFQ_internal','Logística mineral'),
('B','s3.cat5',2,'EFRAG_ESRS','Estériles, lodos'),
('B','s3.cat6',1,'NFQ_internal',null),
('B','s3.cat7',1,'NFQ_internal',null),
('B','s3.cat11',3,'EFRAG_ESRS','Combustión downstream del producto vendido'),
('B','s3.cat15',0,'NFQ_internal',null),

-- C · Industria manufacturera (sección general)
('C','s1',3,'EFRAG_ESRS','Combustión + procesos químicos'),
('C','s2',3,'SASB','Alta intensidad eléctrica'),
('C','s3.cat1',3,'EFRAG_ESRS','Materias primas: hotspot principal típicamente'),
('C','s3.cat3',2,'NFQ_internal','WTT'),
('C','s3.cat4',3,'EFRAG_ESRS','Inbound + outbound logistics'),
('C','s3.cat5',2,'NFQ_internal','Residuos de proceso'),
('C','s3.cat6',1,'NFQ_internal',null),
('C','s3.cat7',1,'NFQ_internal',null),
('C','s3.cat11',2,'EFRAG_ESRS','Use of sold products (depende del producto)'),
('C','s3.cat15',0,'NFQ_internal',null),

-- D · Suministro de energía eléctrica, gas, vapor
('D','s1',3,'EFRAG_ESRS','Combustión en generación · CO2 process'),
('D','s2',2,'NFQ_internal','Bombeo, servicios auxiliares'),
('D','s3.cat1',2,'SASB','Combustibles comprados'),
('D','s3.cat3',3,'EFRAG_ESRS','WTT del fuel comprado: muy material'),
('D','s3.cat4',2,'NFQ_internal','Logística de combustible'),
('D','s3.cat5',1,'NFQ_internal',null),
('D','s3.cat6',1,'NFQ_internal',null),
('D','s3.cat7',1,'NFQ_internal',null),
('D','s3.cat11',3,'EFRAG_ESRS','CO2 de la electricidad/gas vendido — hotspot'),
('D','s3.cat15',0,'NFQ_internal',null),

-- E · Agua, saneamiento, residuos
('E','s1',2,'NFQ_internal','Combustión flotas, biogás'),
('E','s2',3,'EFRAG_ESRS','Bombeo y tratamiento — alta intensidad eléctrica'),
('E','s3.cat1',2,'SASB','Reactivos químicos'),
('E','s3.cat3',2,'NFQ_internal','WTT'),
('E','s3.cat4',2,'NFQ_internal','Recogida residuos'),
('E','s3.cat5',2,'EFRAG_ESRS','Emisiones del propio residuo gestionado'),
('E','s3.cat6',1,'NFQ_internal',null),
('E','s3.cat7',1,'NFQ_internal',null),
('E','s3.cat11',2,'NFQ_internal','Tratamiento downstream'),
('E','s3.cat15',0,'NFQ_internal',null),

-- F · Construcción
('F','s1',2,'EFRAG_ESRS','Maquinaria diésel, calderas obra'),
('F','s2',2,'NFQ_internal','Iluminación, oficinas'),
('F','s3.cat1',3,'EFRAG_ESRS','Cemento, acero, aluminio: hotspot principal'),
('F','s3.cat3',2,'NFQ_internal','WTT'),
('F','s3.cat4',2,'NFQ_internal','Transporte de materiales'),
('F','s3.cat5',2,'EFRAG_ESRS','Residuos de construcción y demolición'),
('F','s3.cat6',1,'NFQ_internal',null),
('F','s3.cat7',1,'NFQ_internal',null),
('F','s3.cat11',2,'EFRAG_ESRS','Energía operativa de edificios construidos'),
('F','s3.cat15',0,'NFQ_internal',null),

-- G · Comercio
('G','s1',1,'NFQ_internal','Mínimo (flota propia limitada)'),
('G','s2',2,'EFRAG_ESRS','Tiendas, climatización, refrigeración'),
('G','s3.cat1',3,'EFRAG_ESRS','Productos vendidos: hotspot'),
('G','s3.cat3',1,'NFQ_internal',null),
('G','s3.cat4',3,'EFRAG_ESRS','Logística inbound + outbound — alta'),
('G','s3.cat5',2,'NFQ_internal','Embalajes, devoluciones'),
('G','s3.cat6',1,'NFQ_internal',null),
('G','s3.cat7',1,'NFQ_internal',null),
('G','s3.cat11',2,'NFQ_internal','Uso de productos vendidos (e.g. electrónicos)'),
('G','s3.cat15',0,'NFQ_internal',null),

-- H · Transporte y almacenamiento
('H','s1',3,'EFRAG_ESRS','Combustión flota propia: hotspot'),
('H','s2',2,'NFQ_internal','Almacenes, terminales'),
('H','s3.cat1',1,'NFQ_internal','Recambios, mantenimiento'),
('H','s3.cat3',3,'EFRAG_ESRS','WTT del combustible: alto'),
('H','s3.cat4',2,'NFQ_internal','Subcontratos'),
('H','s3.cat5',1,'NFQ_internal',null),
('H','s3.cat6',1,'NFQ_internal',null),
('H','s3.cat7',1,'NFQ_internal',null),
('H','s3.cat11',2,'EFRAG_ESRS','Vehículos vendidos / leasing'),
('H','s3.cat15',0,'NFQ_internal',null),

-- I · Hostelería
('I','s1',2,'NFQ_internal','Cocinas, calefacción, agua caliente'),
('I','s2',3,'EFRAG_ESRS','Climatización hoteles/restaurantes'),
('I','s3.cat1',3,'EFRAG_ESRS','Compras alimentarias: hotspot'),
('I','s3.cat3',2,'NFQ_internal','WTT'),
('I','s3.cat4',1,'NFQ_internal',null),
('I','s3.cat5',2,'EFRAG_ESRS','Residuos orgánicos, food waste'),
('I','s3.cat6',1,'NFQ_internal',null),
('I','s3.cat7',1,'NFQ_internal',null),
('I','s3.cat11',0,'NFQ_internal','No aplica'),
('I','s3.cat15',0,'NFQ_internal',null),

-- J · Información y comunicaciones
('J','s1',1,'NFQ_internal','Mínimo (oficinas, generadores backup)'),
('J','s2',3,'EFRAG_ESRS','Data centers / oficinas — alta'),
('J','s3.cat1',3,'EFRAG_ESRS','Hardware, equipos, software comprado'),
('J','s3.cat3',2,'NFQ_internal',null),
('J','s3.cat4',1,'NFQ_internal',null),
('J','s3.cat5',1,'NFQ_internal','E-waste'),
('J','s3.cat6',2,'EFRAG_ESRS','Viajes de negocio (consultoras tech)'),
('J','s3.cat7',2,'NFQ_internal','Empleados (tech con muchas oficinas)'),
('J','s3.cat11',2,'EFRAG_ESRS','Energía consumida por dispositivos vendidos'),
('J','s3.cat15',0,'NFQ_internal',null),

-- K · Financieras y seguros
('K','s1',1,'NFQ_internal','Oficinas — mínimo'),
('K','s2',2,'NFQ_internal','Oficinas, datacenters internos'),
('K','s3.cat1',2,'EFRAG_ESRS','Servicios profesionales, IT'),
('K','s3.cat3',1,'NFQ_internal',null),
('K','s3.cat4',1,'NFQ_internal',null),
('K','s3.cat5',1,'NFQ_internal',null),
('K','s3.cat6',3,'EFRAG_ESRS','Viajes de negocio: típicamente alta'),
('K','s3.cat7',2,'NFQ_internal','Workforce numerosa con commute'),
('K','s3.cat11',0,'NFQ_internal','No aplica'),
('K','s3.cat15',3,'EFRAG_ESRS','Financed emissions — el hotspot del sector (PCAF)'),

-- L · Inmobiliarias
('L','s1',1,'NFQ_internal',null),
('L','s2',2,'NFQ_internal','Edificios en cartera con consumo común'),
('L','s3.cat1',2,'EFRAG_ESRS','Construcción, mantenimiento'),
('L','s3.cat3',1,'NFQ_internal',null),
('L','s3.cat4',1,'NFQ_internal',null),
('L','s3.cat5',1,'NFQ_internal',null),
('L','s3.cat6',1,'NFQ_internal',null),
('L','s3.cat7',1,'NFQ_internal',null),
('L','s3.cat11',3,'EFRAG_ESRS','Energía operativa de inmuebles arrendados/vendidos: hotspot'),
('L','s3.cat15',0,'NFQ_internal',null),

-- M · Profesionales (consultoría, ingeniería, legal)
('M','s1',1,'NFQ_internal',null),
('M','s2',2,'NFQ_internal','Oficinas'),
('M','s3.cat1',2,'EFRAG_ESRS','IT, papel, servicios subcontratados'),
('M','s3.cat3',1,'NFQ_internal',null),
('M','s3.cat4',1,'NFQ_internal',null),
('M','s3.cat5',1,'NFQ_internal',null),
('M','s3.cat6',2,'EFRAG_ESRS','Viajes a clientes'),
('M','s3.cat7',2,'NFQ_internal','Commute'),
('M','s3.cat11',1,'NFQ_internal',null),
('M','s3.cat15',0,'NFQ_internal',null),

-- N · Administrativas y servicios auxiliares
('N','s1',1,'NFQ_internal',null),
('N','s2',2,'NFQ_internal','Oficinas'),
('N','s3.cat1',2,'NFQ_internal',null),
('N','s3.cat3',1,'NFQ_internal',null),
('N','s3.cat4',1,'NFQ_internal',null),
('N','s3.cat5',1,'NFQ_internal',null),
('N','s3.cat6',2,'NFQ_internal',null),
('N','s3.cat7',2,'NFQ_internal',null),
('N','s3.cat11',0,'NFQ_internal',null),
('N','s3.cat15',0,'NFQ_internal',null),

-- O · Administración pública
('O','s1',2,'NFQ_internal','Vehículos públicos, calefacción edificios'),
('O','s2',2,'NFQ_internal','Edificios públicos'),
('O','s3.cat1',2,'NFQ_internal','Compras públicas'),
('O','s3.cat3',1,'NFQ_internal',null),
('O','s3.cat4',1,'NFQ_internal',null),
('O','s3.cat5',1,'NFQ_internal',null),
('O','s3.cat6',2,'NFQ_internal',null),
('O','s3.cat7',2,'NFQ_internal',null),
('O','s3.cat11',0,'NFQ_internal',null),
('O','s3.cat15',0,'NFQ_internal',null),

-- P · Educación
('P','s1',1,'NFQ_internal',null),
('P','s2',2,'NFQ_internal','Calefacción/climatización aulas'),
('P','s3.cat1',2,'NFQ_internal','Material didáctico, IT'),
('P','s3.cat3',1,'NFQ_internal',null),
('P','s3.cat4',1,'NFQ_internal',null),
('P','s3.cat5',1,'NFQ_internal',null),
('P','s3.cat6',1,'NFQ_internal',null),
('P','s3.cat7',2,'NFQ_internal','Commute estudiantes/staff'),
('P','s3.cat11',0,'NFQ_internal',null),
('P','s3.cat15',0,'NFQ_internal',null),

-- Q · Sanidad
('Q','s1',2,'EFRAG_ESRS','Anestesia, refrigerantes, generadores'),
('Q','s2',3,'EFRAG_ESRS','Hospitales — alta intensidad eléctrica'),
('Q','s3.cat1',2,'EFRAG_ESRS','Material sanitario, fármacos'),
('Q','s3.cat3',2,'NFQ_internal',null),
('Q','s3.cat4',1,'NFQ_internal',null),
('Q','s3.cat5',2,'EFRAG_ESRS','Residuos sanitarios'),
('Q','s3.cat6',1,'NFQ_internal',null),
('Q','s3.cat7',1,'NFQ_internal',null),
('Q','s3.cat11',1,'NFQ_internal',null),
('Q','s3.cat15',0,'NFQ_internal',null),

-- R · Artes, recreación
('R','s1',1,'NFQ_internal',null),
('R','s2',2,'NFQ_internal','Salas, instalaciones'),
('R','s3.cat1',2,'NFQ_internal',null),
('R','s3.cat3',1,'NFQ_internal',null),
('R','s3.cat4',1,'NFQ_internal',null),
('R','s3.cat5',1,'NFQ_internal',null),
('R','s3.cat6',2,'NFQ_internal','Tours, eventos'),
('R','s3.cat7',1,'NFQ_internal',null),
('R','s3.cat11',1,'NFQ_internal',null),
('R','s3.cat15',0,'NFQ_internal',null),

-- S · Otros servicios
('S','s1',1,'NFQ_internal',null),
('S','s2',2,'NFQ_internal',null),
('S','s3.cat1',2,'NFQ_internal',null),
('S','s3.cat3',1,'NFQ_internal',null),
('S','s3.cat4',1,'NFQ_internal',null),
('S','s3.cat5',1,'NFQ_internal',null),
('S','s3.cat6',1,'NFQ_internal',null),
('S','s3.cat7',1,'NFQ_internal',null),
('S','s3.cat11',0,'NFQ_internal',null),
('S','s3.cat15',0,'NFQ_internal',null),

-- T · Hogares como empleadores (no aplica reporting típico)
('T','s1',0,'NFQ_internal','No aplica reporting corporativo'),
('T','s2',0,'NFQ_internal',null),
('T','s3.cat1',0,'NFQ_internal',null),
('T','s3.cat3',0,'NFQ_internal',null),
('T','s3.cat4',0,'NFQ_internal',null),
('T','s3.cat5',0,'NFQ_internal',null),
('T','s3.cat6',0,'NFQ_internal',null),
('T','s3.cat7',0,'NFQ_internal',null),
('T','s3.cat11',0,'NFQ_internal',null),
('T','s3.cat15',0,'NFQ_internal',null),

-- U · Organismos extraterritoriales
('U','s1',0,'NFQ_internal','No aplica'),
('U','s2',0,'NFQ_internal',null),
('U','s3.cat1',0,'NFQ_internal',null),
('U','s3.cat3',0,'NFQ_internal',null),
('U','s3.cat4',0,'NFQ_internal',null),
('U','s3.cat5',0,'NFQ_internal',null),
('U','s3.cat6',0,'NFQ_internal',null),
('U','s3.cat7',0,'NFQ_internal',null),
('U','s3.cat11',0,'NFQ_internal',null),
('U','s3.cat15',0,'NFQ_internal',null)
on conflict (sector_code, scope_category, source_framework) do nothing;

-- ── 4. Overrides clave a nivel división ─────────────────────────────────
-- Sólo donde la división difiere significativamente del padre.

insert into public.industry_materiality (sector_code, scope_category, materiality, source_framework, notes) values
-- C.10 Alimentación: cat1 muy alto (food procurement upstream)
('C.10','s3.cat1',3,'EFRAG_ESRS','Materias primas agrícolas: hotspot dominante'),
('C.10','s3.cat5',3,'NFQ_internal','Food waste relevante'),

-- C.19 Refino petróleo: s1 alto procesos, cat11 dominante
('C.19','s1',3,'EFRAG_ESRS','Procesos de refinado'),
('C.19','s3.cat11',3,'EFRAG_ESRS','Combustión de productos refinados vendidos'),

-- C.20 Química: s1 muy alto (procesos), cat1 alto
('C.20','s1',3,'EFRAG_ESRS','Procesos químicos N2O, CH4'),
('C.20','s3.cat11',3,'EFRAG_ESRS','Uso downstream productos químicos'),

-- C.23 Cemento/vidrio: s1 dominante (calcination)
('C.23','s1',3,'EFRAG_ESRS','CO2 de calcination caliza — hotspot'),

-- C.24 Metalurgia: s1 alto (procesos), s2 alto
('C.24','s1',3,'EFRAG_ESRS','Reducción de óxidos, hornos'),
('C.24','s3.cat1',3,'SASB','Mineral, chatarra, coque'),

-- D.35 Energía eléctrica: cat11 dominante
('D.35','s3.cat11',3,'EFRAG_ESRS','CO2 electricidad vendida — hotspot'),

-- F.41 Construcción de edificios: cat11 alto (energía operativa post-handover)
('F.41','s3.cat11',3,'EFRAG_ESRS','Embodied + operational carbon'),

-- G.47 Retail: cat1 + cat4 dominantes
('G.47','s3.cat1',3,'EFRAG_ESRS','Productos vendidos'),
('G.47','s3.cat4',3,'EFRAG_ESRS','Logística'),

-- H.51 Transporte aéreo: s1 muy alto, cat3 alto, cat11 N/A (operador, no fabricante)
('H.51','s1',3,'EFRAG_ESRS','Combustible aviación'),
('H.51','s3.cat11',1,'NFQ_internal','Sólo si vende aviones'),

-- J.63 Data centers: s2 dominante
('J.63','s2',3,'EFRAG_ESRS','Data center cooling + compute'),
('J.63','s3.cat1',3,'EFRAG_ESRS','Servidores, hardware'),

-- K.64 Banca: cat15 dominante (PCAF)
('K.64','s3.cat15',3,'EFRAG_ESRS','Cartera de préstamos e inversiones — PCAF'),

-- K.65 Seguros: cat15 alto (underwriting + invested assets)
('K.65','s3.cat15',3,'EFRAG_ESRS','Insurance underwriting + invested assets — PCAF'),

-- L.68 Inmobiliarias: cat11 alto (uso operativo de inmuebles)
('L.68','s3.cat11',3,'EFRAG_ESRS','Energía edificios cartera'),

-- Q.86 Sanidad: refrigerantes alto, cat5 alto
('Q.86','s1',3,'EFRAG_ESRS','Anestésicos volátiles, refrigerantes'),
('Q.86','s3.cat5',3,'EFRAG_ESRS','Residuos sanitarios peligrosos')
on conflict (sector_code, scope_category, source_framework) do nothing;
