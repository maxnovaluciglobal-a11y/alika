-- Tier 3-K (plan Dentidesk, decisión de Walter 2026-08-26: modelo mixto):
-- liquidación de comisiones por profesional. Cada profesional tiene UNA regla
-- activa, que puede ser de dos tipos (de ahí "mixto" — el sistema soporta
-- ambos, cada profesional elige el suyo):
--   'percent'  → comisión = percent_bps/10000 × producción del período
--   'fixed'    → comisión = fixed_cents × nº de procedimientos completados
--
-- "Producción" = suma de price_cents de treatment_items con status='completed'
-- cuyo completed_at cae en el período liquidado. Se usa producción realizada
-- (no lo pagado): es lo que el profesional efectivamente hizo, independiente
-- del flujo de cobro. Decisión documentada — revisar si algún piloto pide
-- comisionar sobre lo cobrado.
--
-- Es CONFIGURACIÓN, no un evento versionado: se edita en el lugar (no historial
-- de reglas). Un cambio de regla afecta liquidaciones futuras, no recalcula el
-- pasado ya pagado — el reporte se calcula sobre la regla vigente al mirarlo,
-- así que liquidar y archivar el PDF/estado del período es responsabilidad de
-- quien lo corre (no hay tabla de liquidaciones cerradas todavía).

CREATE TABLE public.commission_rules (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('percent', 'fixed')),
  -- Basis points (1% = 100 bps) para no perder precisión con decimales.
  percent_bps integer NOT NULL DEFAULT 0 CHECK (percent_bps BETWEEN 0 AND 10000),
  fixed_cents bigint NOT NULL DEFAULT 0 CHECK (fixed_cents >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (clinic_id, professional_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

-- SELECT: roles que ven finanzas (owner/admin/accounting) — la comisión es
-- dato económico sensible, no operativo. Coincide con finance:view.
CREATE POLICY "commission_rules_select" ON public.commission_rules
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(clinic_id, ARRAY['owner','admin','accounting']::public.app_role[])
  );

-- WRITE: solo owner/admin (fija cuánto se le paga a un tercero — accounting
-- reporta pero no define la regla).
CREATE POLICY "commission_rules_write" ON public.commission_rules
  FOR ALL TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));
