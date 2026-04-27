-- ========================================================================
-- emission_entries: trazabilidad explícita de conversión de unidades
-- ========================================================================
-- v1.1 guardaba la traza ("50.000 m³ × 11.7 = 585.000 kWh PCS") en
-- `data_quality_notes`. Eso es legible pero no estructurado y se mezcla
-- con las notas del analista. Ahora separamos:
--
--   quantity_input        — cantidad ORIGINAL introducida por el analista
--   quantity_input_unit   — unidad ORIGINAL (la que escribió)
--   conversion_factor     — multiplicador aplicado (1 si no hubo conversión)
--
--   quantity (existente)  — cantidad NORMALIZADA a la unidad del factor
--                            = quantity_input * conversion_factor
--
-- Backfill: para entradas históricas asumimos que no hubo conversión,
-- así que quantity_input = quantity, quantity_input_unit = unit, factor=1.

alter table public.emission_entries
  add column if not exists quantity_input numeric;

alter table public.emission_entries
  add column if not exists quantity_input_unit text;

alter table public.emission_entries
  add column if not exists conversion_factor numeric not null default 1
    check (conversion_factor > 0);

-- Backfill (idempotente: sólo rellena los nulos)
update public.emission_entries
   set quantity_input = quantity
 where quantity_input is null and quantity is not null;

update public.emission_entries
   set quantity_input_unit = unit
 where quantity_input_unit is null and unit is not null;

comment on column public.emission_entries.quantity_input is
  'Cantidad original introducida por el analista (antes de conversión a la unidad del factor).';
comment on column public.emission_entries.quantity_input_unit is
  'Unidad original introducida por el analista (puede diferir de unit si se aplicó conversión).';
comment on column public.emission_entries.conversion_factor is
  'Multiplicador aplicado para normalizar quantity_input a quantity (=1 si no hubo conversión). quantity = quantity_input * conversion_factor.';
