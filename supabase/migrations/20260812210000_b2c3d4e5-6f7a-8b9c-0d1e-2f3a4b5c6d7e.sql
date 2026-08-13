-- Fase 3A: catálogo de procedimientos, presupuestos y planes de tratamiento.
-- Dinero en enteros (cents), moneda por procedimiento/presupuesto (defaults a CLP).
-- La aceptación de un presupuesto crea automáticamente un plan de tratamiento
-- con sus ítems, vía trigger — la app solo tiene que llamar a acceptQuote.

CREATE TYPE public.quote_status AS ENUM (
  'draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'
);

CREATE TYPE public.treatment_plan_status AS ENUM (
  'active', 'on_hold', 'completed', 'cancelled'
);

CREATE TYPE public.treatment_item_status AS ENUM (
  'pending', 'in_progress', 'completed', 'skipped'
);

-- PROCEDURES (catálogo de la clínica)
CREATE TABLE public.procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  code text,
  name text NOT NULL,
  category text,
  default_price_cents bigint NOT NULL DEFAULT 0 CHECK (default_price_cents >= 0),
  currency text NOT NULL DEFAULT 'CLP',
  duration_min integer,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX procedures_clinic_idx ON public.procedures (clinic_id, is_active, name);
CREATE INDEX procedures_clinic_category_idx ON public.procedures (clinic_id, category);
CREATE TRIGGER procedures_updated_at BEFORE UPDATE ON public.procedures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedures TO authenticated;
GRANT ALL ON public.procedures TO service_role;
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "procedures_select_members" ON public.procedures
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "procedures_write_managers" ON public.procedures
  FOR ALL TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist']::public.app_role[]));

-- QUOTES
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- correlativo por clínica; unique por clinic para evitar duplicados
  number text NOT NULL,
  status public.quote_status NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'CLP',
  subtotal_cents bigint NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  discount_cents bigint NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  total_cents bigint NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  notes text,
  valid_until date,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  accepted_by_name text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, number)
);
CREATE INDEX quotes_clinic_patient_idx ON public.quotes (clinic_id, patient_id, created_at DESC);
CREATE INDEX quotes_clinic_status_idx ON public.quotes (clinic_id, status);
CREATE TRIGGER quotes_updated_at BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_select_members" ON public.quotes
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "quotes_write_finance_roles" ON public.quotes
  FOR ALL TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]));

-- QUOTE_ITEMS
CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL,
  -- snapshot: si borran o renombran el procedimiento, el ítem no cambia
  name_snapshot text NOT NULL,
  tooth_number smallint,
  surface public.tooth_surface,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_cents bigint NOT NULL CHECK (unit_price_cents >= 0),
  discount_cents bigint NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  total_cents bigint NOT NULL CHECK (total_cents >= 0),
  position integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quote_items_quote_idx ON public.quote_items (quote_id, position);
CREATE INDEX quote_items_clinic_idx ON public.quote_items (clinic_id, quote_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_items_select_members" ON public.quote_items
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "quote_items_write_finance_roles" ON public.quote_items
  FOR ALL TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]));

-- TREATMENT_PLANS
CREATE TABLE public.treatment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  name text NOT NULL,
  status public.treatment_plan_status NOT NULL DEFAULT 'active',
  total_cents bigint NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  currency text NOT NULL DEFAULT 'CLP',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX treatment_plans_clinic_patient_idx ON public.treatment_plans (clinic_id, patient_id, created_at DESC);
CREATE INDEX treatment_plans_clinic_status_idx ON public.treatment_plans (clinic_id, status);
CREATE TRIGGER treatment_plans_updated_at BEFORE UPDATE ON public.treatment_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_plans TO authenticated;
GRANT ALL ON public.treatment_plans TO service_role;
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "treatment_plans_select_members" ON public.treatment_plans
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "treatment_plans_write_finance_roles" ON public.treatment_plans
  FOR ALL TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]));

-- TREATMENT_ITEMS
CREATE TABLE public.treatment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.treatment_plans(id) ON DELETE CASCADE,
  procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL,
  quote_item_id uuid REFERENCES public.quote_items(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  tooth_number smallint,
  surface public.tooth_surface,
  status public.treatment_item_status NOT NULL DEFAULT 'pending',
  price_cents bigint NOT NULL CHECK (price_cents >= 0),
  position integer NOT NULL DEFAULT 0,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  scheduled_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  completed_at timestamptz,
  completed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX treatment_items_plan_idx ON public.treatment_items (plan_id, position);
CREATE INDEX treatment_items_clinic_idx ON public.treatment_items (clinic_id, plan_id, status);
CREATE TRIGGER treatment_items_updated_at BEFORE UPDATE ON public.treatment_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_items TO authenticated;
GRANT ALL ON public.treatment_items TO service_role;
ALTER TABLE public.treatment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "treatment_items_select_members" ON public.treatment_items
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "treatment_items_write_finance_roles" ON public.treatment_items
  FOR ALL TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]));

-- Trigger: al aceptar un presupuesto (UPDATE status='accepted'), crear el plan
-- de tratamiento con sus ítems copiados, y marcar el quote como 'converted'.
-- SECURITY DEFINER para poder insertar en treatment_plans/items sin importar
-- desde qué contexto de rol se dispare, siempre y cuando el UPDATE del quote
-- haya pasado su propia policy.
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
  -- Solo actúa en la transición a 'accepted' (ignora otros updates)
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
    tooth_number, surface, status, price_cents, position, notes
  )
  SELECT
    qi.clinic_id, new_plan_id, qi.procedure_id, qi.id, qi.name_snapshot,
    qi.tooth_number, qi.surface, 'pending'::public.treatment_item_status,
    qi.total_cents, qi.position, qi.notes
  FROM public.quote_items qi
  WHERE qi.quote_id = NEW.id
  ORDER BY qi.position;

  -- Marcar el presupuesto como convertido (además de accepted)
  NEW.status := 'converted';
  NEW.accepted_at := COALESCE(NEW.accepted_at, now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER quote_accept_creates_plan
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.convert_accepted_quote_to_plan();
