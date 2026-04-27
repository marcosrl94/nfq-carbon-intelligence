-- ========================================================================
-- emission_entries.data_quality_tier  +  data_quality_notes
-- ========================================================================
-- v1.1 "defendible ante auditor" — tiering por entrada (ESRS/CSRD).
--
--   tier 1 = activity primaria + EF supplier-specific
--   tier 2 = activity primaria + EF genérico del catálogo (caso más común)
--   tier 3 = spend-based / estimado
--
-- Default = 3 (estimado). El picker del catálogo en /emissions sobrescribe
-- a 2 al crear la entrada; el analista puede subir a 1 si dispone de un
-- factor supplier-specific verificable.
--
-- data_quality_notes: comentario libre del analista (origen del dato,
-- supuestos, fuente de la factura, etc.) — puro texto, sin estructura.

alter table public.emission_entries
  add column if not exists data_quality_tier smallint not null default 3
    check (data_quality_tier in (1, 2, 3));

alter table public.emission_entries
  add column if not exists data_quality_notes text;

comment on column public.emission_entries.data_quality_tier is
  'ESRS/CSRD data quality tier. 1 = primary activity + supplier-specific EF · 2 = primary activity + generic catalog EF · 3 = spend-based / estimado.';

comment on column public.emission_entries.data_quality_notes is
  'Comentario libre del analista sobre el origen y la calidad del dato (auditable).';

-- Útil para el bloque "Calidad del dato" del dashboard (agregados por tier).
create index if not exists idx_emission_entries_tier
  on public.emission_entries(inventory_id, data_quality_tier);
