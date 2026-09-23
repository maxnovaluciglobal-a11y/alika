-- Módulo dedicado de Ortodoncia: brackets/alineadores con seguimiento y
-- cobro mensual atado al control.
--
-- Gap de la auditoría comparativa vs. SuperClini (22-sep-2026): "Ortodoncia"
-- hoy solo existe como especialidad predefinida (onboarding-types.ts) y como
-- una plantilla de nota clínica. No hay tabla que rastree un caso a lo largo
-- del tiempo ni sus controles mensuales.

CREATE TYPE public.ortho_case_kind AS ENUM ('brackets', 'aligners');
CREATE TYPE public.ortho_case_status AS ENUM ('active', 'on_hold', 'completed', 'cancelled');

CREATE TABLE public.ortho_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  -- Snapshot inmutable si el plan de tratamiento se borra — el caso de
  -- ortodoncia sigue existiendo como historial aunque el plan original ya no.
  treatment_plan_id uuid REFERENCES public.treatment_plans(id) ON DELETE SET NULL,
  kind public.ortho_case_kind NOT NULL,
  status public.ortho_case_status NOT NULL DEFAULT 'active',
  started_on date NOT NULL,
  expected_end_on date,
  currency text NOT NULL DEFAULT 'CLP',
  monthly_fee_cents bigint CHECK (monthly_fee_cents IS NULL OR monthly_fee_cents >= 0),
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ortho_cases IS
  'Caso de ortodoncia (brackets o alineadores) de un paciente, con cuota mensual opcional. Ver ortho_controls para el historial de controles.';

CREATE INDEX ortho_cases_clinic_status_idx ON public.ortho_cases (clinic_id, status);
CREATE INDEX ortho_cases_patient_idx ON public.ortho_cases (clinic_id, patient_id);

-- Un control mensual: si el paciente vino y si ese mes se cobró la cuota.
-- `payment_id` es el vínculo real al cobro (nullable — regla 11, no fabricar
-- un pago que no ocurrió) para que la cuota de ortodoncia y el pago dejen de
-- vivir en cuadernos distintos, sin duplicar el motor de pagos existente.
CREATE TABLE public.ortho_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ortho_case_id uuid NOT NULL REFERENCES public.ortho_cases(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  control_date date NOT NULL,
  attended boolean NOT NULL DEFAULT true,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ortho_controls IS
  'Un control de un caso de ortodoncia: si vino y si se cobró la cuota de ese mes (payment_id).';

CREATE INDEX ortho_controls_case_idx ON public.ortho_controls (ortho_case_id, control_date DESC);

ALTER TABLE public.ortho_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ortho_controls ENABLE ROW LEVEL SECURITY;

-- Mismo criterio que treatment_plans: cualquier miembro clínico ve, la
-- escritura es de quien gestiona tratamientos (no accounting/reception,
-- que no editan historia de tratamiento).
CREATE POLICY ortho_cases_select_members ON public.ortho_cases
  FOR SELECT USING (public.is_clinic_member(clinic_id));

CREATE POLICY ortho_cases_write_clinical_roles ON public.ortho_cases
  FOR ALL
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]));

CREATE POLICY ortho_controls_select_members ON public.ortho_controls
  FOR SELECT USING (public.is_clinic_member(clinic_id));

CREATE POLICY ortho_controls_write_clinical_roles ON public.ortho_controls
  FOR ALL
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]));

CREATE TRIGGER moneda_desde_la_clinica
  BEFORE INSERT ON public.ortho_cases
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_moneda_de_la_clinica();

ALTER TABLE public.ortho_cases ALTER COLUMN currency DROP DEFAULT;

CREATE TRIGGER ortho_cases_updated_at BEFORE UPDATE ON public.ortho_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
