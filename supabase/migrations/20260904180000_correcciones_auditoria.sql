-- Correcciones de la auditoría multi-agente del 04-sep-2026.
--
-- Cinco agentes revisaron en paralelo lo construido en las Tandas A, B y C.
-- Esta migración cierra los hallazgos que viven en la base; los de código van
-- en el mismo commit.

-- ═══ 1 · El trigger de conversión se podía disparar dos veces ════════════
-- La guarda era `OLD.status = 'accepted'`, pero el propio trigger termina con
-- `NEW.status := 'converted'`, así que la fila persistida NUNCA queda en
-- 'accepted' y la condición jamás volvía a ser cierta.
--
-- Consecuencia real: llamar `setQuoteStatus(quoteId, 'accepted')` sobre un
-- presupuesto ya convertido creaba OTRO plan de tratamiento con los mismos
-- ítems. Como `fetchPatientBalances` suma los `treatment_items` de todos los
-- planes no cancelados, el saldo del paciente se duplicaba — y ese saldo
-- alimenta el badge de la agenda y el aviso de deuda por WhatsApp. Al
-- paciente le llegaba un cobro por el doble de lo que debe.
--
-- El bug venía de la migración original de agosto; las dos reescrituras de
-- septiembre (fases y convenios) lo arrastraron sin verlo.

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
  -- `OLD.status IN ('accepted','converted')`: 'converted' es el estado en el
  -- que queda realmente un presupuesto ya procesado, así que es el que hay
  -- que mirar para no procesarlo dos veces.
  IF NEW.status <> 'accepted' OR OLD.status IN ('accepted', 'converted') THEN
    RETURN NEW;
  END IF;

  -- Cinturón adicional: si por cualquier camino ya existe un plan para este
  -- presupuesto, no se crea otro.
  IF EXISTS (SELECT 1 FROM public.treatment_plans WHERE quote_id = NEW.id) THEN
    NEW.status := 'converted';
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

-- Un presupuesto genera como mucho un plan. Si el trigger volviera a fallar,
-- la base lo frena en vez de duplicar la deuda de un paciente.
CREATE UNIQUE INDEX IF NOT EXISTS treatment_plans_quote_unico
  ON public.treatment_plans (quote_id) WHERE quote_id IS NOT NULL;

-- ═══ 2 · Costos de proveedor visibles para roles que no deberían ═════════
-- `lab_orders.cost_cents` es lo que la clínica le paga al laboratorio: el
-- mismo tipo de dato que `expenses`, que en la migración anterior sí se
-- restringió a owner/admin/accounting con ese argumento explícito.
--
-- Además `accounting` quedaba EXCLUIDO de una tabla financiera, así que
-- entraba a /laboratorios por el guard de ruta y veía la pantalla vacía.

DROP POLICY IF EXISTS "lab_orders_select_clinical" ON public.lab_orders;
DROP POLICY IF EXISTS "lab_orders_write_clinical" ON public.lab_orders;

-- Ver la orden (qué se mandó, para quién, si llegó) es operativo: lo necesita
-- todo el equipo clínico, incluido quien recibe el paquete en el mostrador.
-- `accounting` se suma porque la orden tiene costo.
CREATE POLICY "lab_orders_select_operativo" ON public.lab_orders
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist','assistant','reception','accounting']::public.app_role[]
    )
  );

CREATE POLICY "lab_orders_write_operativo" ON public.lab_orders
  FOR ALL TO authenticated
  USING (public.has_clinic_role(
    clinic_id,
    ARRAY['owner','admin','dentist','assistant','reception','accounting']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(
    clinic_id,
    ARRAY['owner','admin','dentist','assistant','reception','accounting']::public.app_role[]));

-- El costo en sí se filtra en la capa de servidor según `finance:view`
-- (ver `listLabOrders`): la fila se ve entera, el número solo lo ve quien
-- puede ver plata. Separar la columna en otra tabla sería más limpio pero
-- parte el módulo en dos por un solo campo.

-- ═══ 3 · Autoría falsificable ════════════════════════════════════════════
-- Las cuatro tablas nuevas con `created_by uuid NOT NULL DEFAULT auth.uid()`
-- no lo validaban en el WITH CHECK, así que el default solo aplicaba si el
-- cliente omitía la columna. Un contador podía postear un gasto a nombre del
-- dueño y dejar el rastro de auditoría inservible justo donde más importa.
--
-- `inventory_movements_insert_clinical` ya hacía esto bien desde agosto; acá
-- se replica el patrón.

DROP POLICY IF EXISTS "expenses_write_finance_roles" ON public.expenses;
CREATE POLICY "expenses_select_finance_roles_write" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (
    public.has_clinic_role(clinic_id, ARRAY['owner','admin','accounting']::public.app_role[])
    AND created_by = auth.uid()
  );
CREATE POLICY "expenses_update_finance_roles" ON public.expenses
  FOR UPDATE TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','accounting']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','accounting']::public.app_role[]));
CREATE POLICY "expenses_delete_finance_roles" ON public.expenses
  FOR DELETE TO authenticated USING (
    public.has_clinic_role(clinic_id, ARRAY['owner','admin','accounting']::public.app_role[])
  );

DROP POLICY IF EXISTS "agreements_write_managers" ON public.agreements;
CREATE POLICY "agreements_insert_managers" ON public.agreements
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_clinic(clinic_id) AND created_by = auth.uid());
CREATE POLICY "agreements_update_managers" ON public.agreements
  FOR UPDATE TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));
CREATE POLICY "agreements_delete_managers" ON public.agreements
  FOR DELETE TO authenticated USING (public.can_manage_clinic(clinic_id));

DROP POLICY IF EXISTS "labs_write_managers" ON public.labs;
CREATE POLICY "labs_insert_managers" ON public.labs
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_clinic(clinic_id) AND created_by = auth.uid());
CREATE POLICY "labs_update_managers" ON public.labs
  FOR UPDATE TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));
CREATE POLICY "labs_delete_managers" ON public.labs
  FOR DELETE TO authenticated USING (public.can_manage_clinic(clinic_id));

-- `lab_orders` ya se recreó arriba; se le suma la validación de autoría.
DROP POLICY IF EXISTS "lab_orders_write_operativo" ON public.lab_orders;
CREATE POLICY "lab_orders_insert_operativo" ON public.lab_orders
  FOR INSERT TO authenticated WITH CHECK (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist','assistant','reception','accounting']::public.app_role[])
    AND created_by = auth.uid()
  );
CREATE POLICY "lab_orders_update_operativo" ON public.lab_orders
  FOR UPDATE TO authenticated
  USING (public.has_clinic_role(
    clinic_id,
    ARRAY['owner','admin','dentist','assistant','reception','accounting']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(
    clinic_id,
    ARRAY['owner','admin','dentist','assistant','reception','accounting']::public.app_role[]));
CREATE POLICY "lab_orders_delete_operativo" ON public.lab_orders
  FOR DELETE TO authenticated USING (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist','assistant','reception','accounting']::public.app_role[])
  );

-- ═══ 4 · FKs cruzadas entre clínicas ═════════════════════════════════════
-- Las policies validaban el `clinic_id` de la propia fila pero no el de las
-- filas referenciadas, así que un admin de la clínica A podía insertar una
-- cobertura apuntando a un convenio de la clínica B. El impacto es de
-- integridad y no de confidencialidad (la víctima nunca ve esas filas), pero
-- es el mismo hueco que ya se corrigió en MedOS.

CREATE OR REPLACE FUNCTION public.misma_clinica_agreement(_clinic_id uuid, _agreement_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agreements
     WHERE id = _agreement_id AND clinic_id = _clinic_id
  );
$$;

CREATE OR REPLACE FUNCTION public.misma_clinica_procedure(_clinic_id uuid, _procedure_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.procedures
     WHERE id = _procedure_id AND clinic_id = _clinic_id
  );
$$;

DROP POLICY IF EXISTS "agreement_coverage_write_managers" ON public.agreement_coverage;
CREATE POLICY "agreement_coverage_write_managers" ON public.agreement_coverage
  FOR ALL TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (
    public.can_manage_clinic(clinic_id)
    AND public.misma_clinica_agreement(clinic_id, agreement_id)
    AND public.misma_clinica_procedure(clinic_id, procedure_id)
  );
