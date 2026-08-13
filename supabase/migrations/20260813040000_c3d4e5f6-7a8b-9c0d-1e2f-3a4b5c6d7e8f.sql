-- Fase 3B: pagos y saldo del paciente.
-- Un pago se registra siempre a un paciente. Puede aplicarse a un plan
-- (treatment_plan_id) o a un ítem específico (treatment_item_id), o quedar
-- "a cuenta" (ambos NULL). El saldo real del paciente se calcula agregando
-- pagos vs. total de ítems desde la server function, no se cachea todavía —
-- si el volumen lo justifica, migramos a trigger que mantenga
-- patients.balance_cents. Por ahora ese campo se ignora.

CREATE TYPE public.payment_method AS ENUM (
  'cash', 'debit_card', 'credit_card', 'transfer', 'other'
);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  treatment_plan_id uuid REFERENCES public.treatment_plans(id) ON DELETE SET NULL,
  treatment_item_id uuid REFERENCES public.treatment_items(id) ON DELETE SET NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'CLP',
  method public.payment_method NOT NULL DEFAULT 'cash',
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_clinic_patient_idx ON public.payments (clinic_id, patient_id, paid_at DESC);
CREATE INDEX payments_clinic_plan_idx ON public.payments (clinic_id, treatment_plan_id);
CREATE INDEX payments_clinic_date_idx ON public.payments (clinic_id, paid_at DESC);
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Todo miembro puede leer pagos (accounting los necesita para reportes,
-- dentist para ver saldo del paciente, reception para cobrar en la puerta).
CREATE POLICY "payments_select_members" ON public.payments
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));

-- Escritura para quien maneja el dinero. Excluye assistant (no toca caja).
CREATE POLICY "payments_write_finance_roles" ON public.payments
  FOR ALL TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]));
