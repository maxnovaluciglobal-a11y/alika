-- Auditoría de código 01-sep-2026 (dimensión rendimiento): getQuoteConversionReport
-- filtra quotes por clinic_id + rango de created_at, pero los índices
-- existentes son (clinic_id, patient_id, created_at DESC) y (clinic_id,
-- status) — ninguno sirve de índice para clinic_id + created_at solo, así
-- que Postgres escanea todas las filas de la clínica para el rango de
-- fecha. Mismo patrón ya identificado y resuelto para
-- commissions.functions.ts (migración 20260827030000) — nunca se aplicó acá.
CREATE INDEX IF NOT EXISTS quotes_clinic_created_idx ON public.quotes (clinic_id, created_at);
