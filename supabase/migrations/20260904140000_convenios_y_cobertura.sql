-- Tanda B (2/2) · Convenios y seguros.
--
-- Es el bloqueante de venta más duro que quedaba: en Chile un paciente llega
-- con Fonasa, con Isapre o con convenio de empresa, y eso cambia lo que paga
-- por cada prestación. En Argentina son obras sociales y prepagas; en México,
-- aseguradoras; en Colombia, EPS. Sin esto cada presupuesto se calcula a mano
-- fuera del sistema, y ahí el cliente ya se perdió.
--
-- ── La decisión que importa: quién debe cuánto ───────────────────────────
-- Si el convenio cubre el 60 %, el paciente NO debe el 100 %. Por eso las
-- líneas guardan `coverage_cents` (lo que pone el convenio) y `patient_cents`
-- (lo que pone el paciente), y `fetchPatientBalances` pasa a sumar el segundo.
-- Ese helper alimenta el saldo de la ficha, el badge de la agenda y el aviso
-- de `payment_due`: los tres quedan corregidos a la vez, que es exactamente
-- por qué en su momento se unificaron en un solo lugar.
--
-- Ambas columnas son NULLABLE y significan "sin convenio", no "cero" (regla
-- 11). Un presupuesto sin convenio las deja en NULL y todo el cálculo cae al
-- `total_cents` / `price_cents` de siempre: cero cambios de comportamiento
-- para las clínicas que no usan convenios.

-- ── Convenios ────────────────────────────────────────────────────────────

CREATE TABLE public.agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  -- Texto libre y no enum: el vocabulario cambia por país (Fonasa / Isapre en
  -- Chile, obra social y prepaga en Argentina, EPS en Colombia) y encerrarlo
  -- en un enum obliga a migrar la base para vender en el país siguiente.
  kind text,
  -- Datos de contacto del convenio, para cuando hay que reclamar un rechazo.
  contact_name text,
  contact_phone text,
  contact_email text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, name)
);

CREATE INDEX agreements_clinic_idx ON public.agreements (clinic_id, is_active, name);
CREATE TRIGGER agreements_updated_at BEFORE UPDATE ON public.agreements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agreements TO authenticated;
GRANT ALL ON public.agreements TO service_role;
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

-- SELECT para todo miembro: recepción tiene que ver con qué convenio viene un
-- paciente al agendarlo, y quien presupuesta necesita elegirlo.
CREATE POLICY "agreements_select_members" ON public.agreements
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));

CREATE POLICY "agreements_write_managers" ON public.agreements
  FOR ALL TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));

-- Convenio del paciente. Nullable = particular, que es el caso más común.
ALTER TABLE public.patients
  ADD COLUMN agreement_id uuid REFERENCES public.agreements(id) ON DELETE SET NULL,
  -- Nº de afiliado / credencial. Va acá y no en el convenio: es del paciente.
  ADD COLUMN agreement_member_id text;

CREATE INDEX patients_agreement_idx
  ON public.patients (clinic_id, agreement_id) WHERE agreement_id IS NOT NULL;

-- ── Cobertura por prestación ─────────────────────────────────────────────

CREATE TABLE public.agreement_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  agreement_id uuid NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  -- Porcentaje de la línea que cubre el convenio...
  coverage_pct numeric(5,2)
    CHECK (coverage_pct IS NULL OR (coverage_pct >= 0 AND coverage_pct <= 100)),
  -- ...o un monto fijo por unidad (el "bono" de valor cerrado). Exactamente
  -- uno de los dos, nunca ambos ni ninguno: un convenio que no dice cuánto
  -- cubre no es una cobertura, es una fila que confunde.
  coverage_fixed_cents bigint CHECK (coverage_fixed_cents IS NULL OR coverage_fixed_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agreement_coverage_una_forma CHECK (
    (coverage_pct IS NOT NULL AND coverage_fixed_cents IS NULL) OR
    (coverage_pct IS NULL AND coverage_fixed_cents IS NOT NULL)
  ),
  UNIQUE (agreement_id, procedure_id)
);

CREATE INDEX agreement_coverage_lookup_idx
  ON public.agreement_coverage (clinic_id, agreement_id, procedure_id);
CREATE TRIGGER agreement_coverage_updated_at BEFORE UPDATE ON public.agreement_coverage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agreement_coverage TO authenticated;
GRANT ALL ON public.agreement_coverage TO service_role;
ALTER TABLE public.agreement_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agreement_coverage_select_members" ON public.agreement_coverage
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));

CREATE POLICY "agreement_coverage_write_managers" ON public.agreement_coverage
  FOR ALL TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));

-- ── Reparto en presupuestos y planes ─────────────────────────────────────

ALTER TABLE public.quotes
  ADD COLUMN agreement_id uuid REFERENCES public.agreements(id) ON DELETE SET NULL,
  -- Snapshot inmutable (regla 10): renombrar o borrar el convenio no puede
  -- mutar un presupuesto que el paciente ya firmó.
  ADD COLUMN agreement_name_snapshot text,
  -- Total que pone el convenio. NULL = presupuesto sin convenio.
  ADD COLUMN coverage_total_cents bigint
    CHECK (coverage_total_cents IS NULL OR coverage_total_cents >= 0);

ALTER TABLE public.quote_items
  ADD COLUMN coverage_cents bigint CHECK (coverage_cents IS NULL OR coverage_cents >= 0),
  ADD COLUMN patient_cents bigint CHECK (patient_cents IS NULL OR patient_cents >= 0);

ALTER TABLE public.treatment_items
  ADD COLUMN coverage_cents bigint CHECK (coverage_cents IS NULL OR coverage_cents >= 0),
  ADD COLUMN patient_cents bigint CHECK (patient_cents IS NULL OR patient_cents >= 0);

COMMENT ON COLUMN public.quote_items.coverage_cents IS
  'Lo que pone el convenio en esta línea. NULL = sin convenio, no cero.';
COMMENT ON COLUMN public.quote_items.patient_cents IS
  'Lo que paga el paciente. NULL = sin convenio; el saldo cae a total_cents.';
COMMENT ON COLUMN public.treatment_items.patient_cents IS
  'Lo que debe el paciente por esta línea. fetchPatientBalances suma esto cuando no es NULL.';

-- ── El trigger de conversión arrastra el reparto ─────────────────────────
-- Tercera y última versión de esta función (original en 20260812210000,
-- fases en 20260903120000). Sin esto, aceptar un presupuesto con convenio
-- produce un plan donde el paciente debe el total y el convenio desaparece
-- justo en el momento en que el tratamiento se vuelve real.

CREATE OR REPLACE FUNCTION public.convert_accepted_quote_to_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_plan_id uuid;
  plan_name text;
BEGIN
  IF NEW.status <> 'accepted' OR OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  plan_name := 'Plan de ' || COALESCE(NEW.number, 'presupuesto');

  INSERT INTO public.treatment_plans (
    clinic_id, patient_id, quote_id, name, status, total_cents, currency, created_by
  )
  VALUES (
    NEW.clinic_id, NEW.patient_id, NEW.id, plan_name, 'active',
    NEW.total_cents, NEW.currency, NEW.created_by
  )
  RETURNING id INTO new_plan_id;

  INSERT INTO public.treatment_items (
    clinic_id, plan_id, procedure_id, quote_item_id, name_snapshot,
    tooth_number, surface, status, price_cents, position, notes,
    phase_label, phase_position, coverage_cents, patient_cents
  )
  SELECT
    qi.clinic_id, new_plan_id, qi.procedure_id, qi.id, qi.name_snapshot,
    qi.tooth_number, qi.surface, 'pending'::public.treatment_item_status,
    qi.total_cents, qi.position, qi.notes,
    qi.phase_label, qi.phase_position, qi.coverage_cents, qi.patient_cents
  FROM public.quote_items qi
  WHERE qi.quote_id = NEW.id
  ORDER BY qi.phase_position, qi.position;

  NEW.status := 'converted';
  NEW.accepted_at := COALESCE(NEW.accepted_at, now());
  RETURN NEW;
END;
$$;
