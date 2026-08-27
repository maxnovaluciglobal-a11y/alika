-- Auditoría 360 v2 (26-ago-2026) — arq-1 + arq-8 + ops-3 + ops-9:
-- `getCommissionReport` recalcula siempre sobre `commission_rules` vigente
-- HOY, sin ningún estado de "período cerrado" — correr el reporte dos veces
-- en el mismo mes (o editar una regla después) puede dar montos distintos
-- para el mismo período ya comunicado/pagado a un profesional.
--
-- Fix: al "cerrar" un período, se congela un snapshot por profesional
-- (regla usada + montos calculados) en esta tabla. `getCommissionReport`
-- sigue calculando en vivo para cualquier rango que NO tenga settlement
-- (el período abierto actual), pero un período ya cerrado nunca vuelve a
-- recalcularse aunque cambie `commission_rules` después — resuelve arq-1/
-- arq-8/ops-9 sin necesitar vigencia temporal en `commission_rules` (que
-- hubiera exigido rediseñar su PK actual de "una fila por profesional").
-- También agrega `paid_at` (ops-3: hoy no hay forma de marcar "ya pagado").

CREATE TABLE public.commission_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  period_from date NOT NULL,
  period_to date NOT NULL,
  -- Snapshot de la regla usada al momento del cierre (no FK viva a
  -- commission_rules — si esa fila se edita o borra después, esto no cambia).
  rule_kind text NOT NULL CHECK (rule_kind IN ('percent', 'fixed')),
  rule_percent_bps integer NOT NULL DEFAULT 0,
  rule_fixed_cents bigint NOT NULL DEFAULT 0,
  production_cents bigint NOT NULL,
  procedure_count integer NOT NULL,
  commission_cents bigint NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid NOT NULL,
  paid_at timestamptz,
  paid_by uuid,
  -- Un profesional no puede tener 2 cierres para el mismo período exacto
  -- (evita duplicar/pagar dos veces el mismo rango por error).
  UNIQUE (clinic_id, professional_id, period_from, period_to)
);
CREATE INDEX commission_settlements_clinic_period_idx
  ON public.commission_settlements (clinic_id, period_from, period_to);

GRANT SELECT, INSERT, UPDATE ON public.commission_settlements TO authenticated;
GRANT ALL ON public.commission_settlements TO service_role;
ALTER TABLE public.commission_settlements ENABLE ROW LEVEL SECURITY;

-- SELECT: owner/admin/accounting ven todo (mismo criterio que commission_rules);
-- ux-3 de la auditoría: el propio profesional también debe poder ver SU
-- liquidación, sin ver la de otros.
CREATE POLICY "commission_settlements_select_managers" ON public.commission_settlements
  FOR SELECT TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','accounting']::public.app_role[]));
CREATE POLICY "commission_settlements_select_own" ON public.commission_settlements
  FOR SELECT TO authenticated
  USING (
    professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid())
  );

-- INSERT (cerrar período): solo owner/admin, igual que definir la regla.
CREATE POLICY "commission_settlements_insert" ON public.commission_settlements
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_clinic(clinic_id));

-- UPDATE: solo para marcar paid_at/paid_by — nunca para tocar los montos
-- congelados (eso lo garantiza el código de la server function, no la
-- policy; RLS acá solo controla QUIÉN puede tocar la fila, no QUÉ columnas).
CREATE POLICY "commission_settlements_update_mark_paid" ON public.commission_settlements
  FOR UPDATE TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));

-- Nunca DELETE — un cierre es un evento contable, no se borra (mismo
-- criterio que security-1 de la auditoría del 21-ago).
