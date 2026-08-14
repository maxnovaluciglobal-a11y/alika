-- Fase 6 · Tanda A · Hardening crítico
--
-- Cierra hallazgos de la auditoría multi-agente del 2026-08-13:
--   1. PHI leak vía RLS: 5 tablas clinical_notes*/clinical_note_* leían PHI
--      con is_clinic_member (todo rol de la clínica), cuando la matriz de
--      permisos solo autoriza clinical:view a owner/admin/dentist/assistant.
--      La UI ocultaba; la base no.
--   2. Trigger convert_accepted_quote_to_plan: guard OLD.status='accepted'
--      no cubre la transición converted -> accepted, así que un segundo
--      accept creaba plan+items duplicados. Doble facturación silenciosa.
--   3. payments legibles por assistant (mismo patrón que #1). No debería
--      ver el detalle financiero por paciente.

-- ─────────────────────────────────────────────────────────────
-- 1. clinical_notes* SELECT: restringir a rol con clinical:view
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "notes_select_members" ON public.clinical_notes;
CREATE POLICY "notes_select_clinical" ON public.clinical_notes FOR SELECT TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]));

DROP POLICY IF EXISTS "note_versions_select_members" ON public.clinical_note_versions;
CREATE POLICY "note_versions_select_clinical" ON public.clinical_note_versions FOR SELECT TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]));

DROP POLICY IF EXISTS "note_audit_select_members" ON public.clinical_note_audit;
CREATE POLICY "note_audit_select_clinical" ON public.clinical_note_audit FOR SELECT TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]));

DROP POLICY IF EXISTS "Miembros ven entidades de su clinica" ON public.clinical_note_entities;
CREATE POLICY "note_entities_select_clinical" ON public.clinical_note_entities FOR SELECT TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]));

DROP POLICY IF EXISTS "Miembros ven revisiones de su clinica" ON public.clinical_note_reviews;
CREATE POLICY "note_reviews_select_clinical" ON public.clinical_note_reviews FOR SELECT TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]));

-- ─────────────────────────────────────────────────────────────
-- 2. Trigger convert_accepted_quote_to_plan: guard robusto
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.convert_accepted_quote_to_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_plan_id uuid;
  plan_name text;
  already_converted boolean;
BEGIN
  -- Actúa solo en la transición fresca a 'accepted'. Cubrir tanto
  -- OLD='accepted' (re-accept del mismo estado) como OLD='converted'
  -- (accept después de que el trigger ya lo marcó como convertido,
  -- que era el vector del bug: converted -> accepted volvía a insertar).
  IF NEW.status <> 'accepted' OR OLD.status IN ('accepted','converted') THEN
    RETURN NEW;
  END IF;

  -- Cinturón + tirantes: si por algún camino ya existe un plan
  -- para este quote, no crear otro.
  SELECT EXISTS (
    SELECT 1 FROM public.treatment_plans WHERE quote_id = NEW.id
  ) INTO already_converted;

  IF already_converted THEN
    NEW.status := 'converted';
    NEW.accepted_at := COALESCE(NEW.accepted_at, now());
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

  NEW.status := 'converted';
  NEW.accepted_at := COALESCE(NEW.accepted_at, now());
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. payments SELECT: excluir assistant
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "payments_select_members" ON public.payments;
CREATE POLICY "payments_select_finance_roles" ON public.payments
  FOR SELECT TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception','accounting']::public.app_role[]));
