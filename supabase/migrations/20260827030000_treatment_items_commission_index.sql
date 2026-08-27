-- Auditoría 360 v2 (26-ago-2026) — arq-9: getCommissionReport filtra
-- treatment_items por (clinic_id, status='completed', completed_at BETWEEN
-- from AND to) sin ningún índice que cubra ese patrón — el índice existente
-- (clinic_id, plan_id, status) no ayuda porque el reporte no filtra por plan.
CREATE INDEX treatment_items_commission_report_idx
  ON public.treatment_items (clinic_id, status, completed_at);
