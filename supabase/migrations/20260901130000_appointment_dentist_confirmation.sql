-- Confirmación de citas reservada al profesional asignado (o owner/admin en
-- su nombre) — antes cualquier rol de agenda (incluida reception) podía
-- mover una cita a 'confirmada'. Pedido real de una clienta potencial:
-- "una vez alguien toma la agenda, el dentista debe aceptarla para que
-- quede confirmada". Decisión de Walter: aplica a TODAS las citas sin
-- excepción, admin/owner puede confirmar en nombre del dentista si este no
-- usa el sistema.

ALTER TABLE public.appointments
  ADD COLUMN confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN confirmed_at timestamptz;

-- SECURITY DEFINER: se invoca desde dentro de una policy de `appointments`,
-- no debe depender de que la policy de `professionals` deje ver la fila.
CREATE FUNCTION public.can_confirm_appointment(p_clinic_id uuid, p_professional_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_clinic_role(p_clinic_id, ARRAY['owner','admin']::public.app_role[])
    OR EXISTS (
      SELECT 1 FROM public.professionals pr
      WHERE pr.id = p_professional_id AND pr.user_id = auth.uid()
    );
$$;

DROP POLICY IF EXISTS "appointments_write_agenda_roles" ON public.appointments;

-- Separada en INSERT/UPDATE/DELETE (antes era un solo FOR ALL) porque la
-- restricción de "confirmada" solo aplica a filas que terminan en ese
-- estado — no se puede expresar con una única condición simétrica en un
-- FOR ALL sin permitir de más en alguna de las tres operaciones.
CREATE POLICY "appointments_insert_agenda_roles" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[])
    AND (status <> 'confirmada' OR public.can_confirm_appointment(clinic_id, professional_id))
  );

CREATE POLICY "appointments_update_agenda_roles" ON public.appointments
  FOR UPDATE TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]))
  WITH CHECK (
    public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[])
    AND (status <> 'confirmada' OR public.can_confirm_appointment(clinic_id, professional_id))
  );

CREATE POLICY "appointments_delete_agenda_roles" ON public.appointments
  FOR DELETE TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]));

-- Trazabilidad automática (mismo patrón que otros triggers de dominio del
-- proyecto: la app solo dispara, el trigger hace el trabajo pesado). Cubre
-- tanto INSERT directo en 'confirmada' (admin/owner) como el UPDATE normal
-- desde el menú de la agenda. Vuelve a null si la cita se destranca de
-- 'confirmada' (ej. se revierte a tentativa por error de carga).
CREATE FUNCTION public.stamp_appointment_confirmation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'confirmada' THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmada' THEN
      NEW.confirmed_by := auth.uid();
      NEW.confirmed_at := now();
    END IF;
  ELSE
    NEW.confirmed_by := NULL;
    NEW.confirmed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER appointments_stamp_confirmation
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.stamp_appointment_confirmation();
