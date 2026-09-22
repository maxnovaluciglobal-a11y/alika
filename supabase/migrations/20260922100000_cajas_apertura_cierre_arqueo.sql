-- Módulo de Cajas: apertura, cierre y arqueo por turno.
--
-- Gap identificado en la auditoría comparativa vs. SuperClini (22-sep-2026):
-- Alika no tenía forma de saber cuánto debería haber en caja en un momento
-- dado, ni de dejar registro de quién abrió/cerró un turno y si cuadró. El
-- reporte de "Caja del período" en Finanzas ya existía (desglose de pagos
-- por método), pero es un informe, no un control operativo de turno.
--
-- Diseño: una sesión de caja (`cash_registers`) por clínica+sucursal a la
-- vez. Los pagos que entran mientras la caja está abierta se vinculan via
-- `payments.cash_register_id` (columna nueva, nullable — regla 11: placeholder
-- nullable, no fabricar un vínculo cuando no hay caja abierta). Al cerrar, lo
-- esperado se calcula UNA vez y se guarda (snapshot inmutable, regla 10): si
-- un pago vinculado se edita después, el cierre ya hecho no se recalcula solo.

CREATE TYPE public.cash_register_status AS ENUM ('open', 'closed');

CREATE TABLE public.cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  status public.cash_register_status NOT NULL DEFAULT 'open',
  currency text NOT NULL DEFAULT 'CLP',
  opening_amount_cents bigint NOT NULL CHECK (opening_amount_cents >= 0),
  opened_by uuid NOT NULL DEFAULT auth.uid(),
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_notes text,
  -- Snapshot al cierre: suma de pagos vinculados a esta caja + apertura.
  expected_closing_cents bigint,
  -- Lo que el cajero contó a mano.
  declared_closing_cents bigint,
  -- declared - expected. Positivo = sobra, negativo = falta.
  difference_cents bigint,
  closed_by uuid,
  closed_at timestamptz,
  closing_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'open' AND closed_at IS NULL AND declared_closing_cents IS NULL
       AND expected_closing_cents IS NULL AND difference_cents IS NULL)
    OR
    (status = 'closed' AND closed_at IS NOT NULL AND declared_closing_cents IS NOT NULL
       AND expected_closing_cents IS NOT NULL AND difference_cents IS NOT NULL)
  )
);

COMMENT ON TABLE public.cash_registers IS
  'Sesión de caja por turno: apertura con monto inicial, cierre con arqueo (esperado vs. contado). Ver payments.cash_register_id.';

-- Solo una caja abierta a la vez por clínica+sucursal. branch_id NULL
-- (clínica sin sucursales configuradas) cuenta como su propia "sucursal"
-- para este efecto — también admite una sola caja abierta.
CREATE UNIQUE INDEX cash_registers_one_open_per_branch
  ON public.cash_registers (clinic_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'open';

CREATE INDEX cash_registers_clinic_opened_idx ON public.cash_registers (clinic_id, opened_at DESC);

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

-- Cualquier miembro de la clínica puede ver el estado de caja (igual que
-- puede ver la agenda del día) — la restricción está en quién abre/cierra.
CREATE POLICY cash_registers_select_members ON public.cash_registers
  FOR SELECT
  USING (public.is_clinic_member(clinic_id));

-- Quién maneja caja en el día a día: dueño, admin, recepción y contabilidad.
-- Dentist/assistant quedan afuera a propósito, igual que en `payments`.
CREATE POLICY cash_registers_insert_cashiers ON public.cash_registers
  FOR INSERT
  WITH CHECK (
    public.has_clinic_role(clinic_id, ARRAY['owner','admin','reception','accounting']::public.app_role[])
    AND opened_by = auth.uid()
  );

CREATE POLICY cash_registers_update_cashiers ON public.cash_registers
  FOR UPDATE
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','reception','accounting']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','reception','accounting']::public.app_role[]));

-- Moneda la fija la clínica, no el cliente (mismo trigger que expenses/
-- payments/procedures/quotes/treatment_plans — ver 20260905120000).
CREATE TRIGGER moneda_desde_la_clinica
  BEFORE INSERT ON public.cash_registers
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_moneda_de_la_clinica();

ALTER TABLE public.cash_registers ALTER COLUMN currency DROP DEFAULT;

-- Vínculo opcional de cada pago a la caja que estaba abierta al cobrarlo.
-- Nullable a propósito (regla 11): un pago registrado sin caja abierta (o en
-- una clínica que todavía no usa el módulo) sigue siendo un pago válido.
ALTER TABLE public.payments
  ADD COLUMN cash_register_id uuid REFERENCES public.cash_registers(id) ON DELETE SET NULL;

CREATE INDEX payments_cash_register_idx ON public.payments (cash_register_id) WHERE cash_register_id IS NOT NULL;
