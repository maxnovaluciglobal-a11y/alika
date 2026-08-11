-- Helper: rol del usuario en una clínica
CREATE OR REPLACE FUNCTION public.clinic_role_of(_clinic_id uuid, _user_id uuid)
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.clinic_members
  WHERE clinic_id = _clinic_id AND user_id = _user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_clinic_member_of(_clinic_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.clinic_members
    WHERE clinic_id = _clinic_id AND user_id = _user_id);
$$;

-- ---------------------------------------------------------------
-- clinical_notes: reglas de transición por estado
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_clinical_note_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role public.app_role;
  v_manager boolean;
  v_clinico boolean;
  v_author boolean;
  v_reviewer boolean;
  v_requester boolean;
  v_content_changed boolean;
  v_status_changed boolean;
  v_review_changed boolean;
  v_reviewer_role public.app_role;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW; -- service_role / procesos internos
  END IF;

  v_role := public.clinic_role_of(OLD.clinic_id, v_uid);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'No perteneces a esta clínica.';
  END IF;

  v_manager  := v_role IN ('owner','admin');
  v_clinico  := v_role IN ('owner','admin','dentist','assistant');
  v_author   := OLD.created_by = v_uid;
  v_reviewer := OLD.reviewer_id = v_uid;
  v_requester := OLD.review_requested_by = v_uid;

  v_content_changed := NEW.title IS DISTINCT FROM OLD.title
    OR NEW.content IS DISTINCT FROM OLD.content
    OR NEW.summary IS DISTINCT FROM OLD.summary;
  v_status_changed := NEW.status IS DISTINCT FROM OLD.status;
  v_review_changed := NEW.review_status IS DISTINCT FROM OLD.review_status
    OR NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id
    OR NEW.review_requested_by IS DISTINCT FROM OLD.review_requested_by;

  IF NOT v_clinico THEN
    RAISE EXCEPTION 'Tu rol no puede modificar notas clínicas.';
  END IF;

  -- La clínica y el paciente de una nota son inmutables
  IF NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.patient_ref IS DISTINCT FROM OLD.patient_ref THEN
    RAISE EXCEPTION 'No se puede reasignar una nota a otra clínica o paciente.';
  END IF;

  -- Edición de contenido
  IF v_content_changed THEN
    IF OLD.status = 'signed' THEN
      RAISE EXCEPTION 'La nota está firmada: reábrela antes de editarla.';
    END IF;
    IF OLD.review_status = 'pending' THEN
      RAISE EXCEPTION 'La nota está en revisión: no puede editarse hasta resolverla.';
    END IF;
    IF NOT (v_author OR v_manager OR v_role = 'dentist') THEN
      RAISE EXCEPTION 'Solo el autor, un doctor/a o un administrador puede editar esta nota.';
    END IF;
  END IF;

  -- Firmar / reabrir
  IF v_status_changed THEN
    IF NEW.status = 'signed' THEN
      IF NOT (v_manager OR v_role = 'dentist') THEN
        RAISE EXCEPTION 'Tu rol no puede firmar notas clínicas.';
      END IF;
    ELSIF NEW.status = 'draft' THEN
      IF OLD.review_status = 'pending' AND NOT (v_reviewer OR v_manager) THEN
        RAISE EXCEPTION 'La nota está en revisión: solo el revisor asignado o un administrador puede reabrirla.';
      END IF;
      IF NOT (v_author OR v_manager OR v_reviewer OR v_role = 'dentist') THEN
        RAISE EXCEPTION 'Tu rol no puede reabrir esta nota.';
      END IF;
    END IF;
  END IF;

  -- Cambios en el flujo de revisión
  IF v_review_changed THEN
    IF NEW.review_status = 'pending' AND OLD.review_status IS DISTINCT FROM 'pending' THEN
      IF NEW.status <> 'signed' THEN
        RAISE EXCEPTION 'Solo puedes enviar a revisión una nota firmada.';
      END IF;
      IF NOT (v_author OR v_manager OR v_role = 'dentist') THEN
        RAISE EXCEPTION 'Tu rol no puede solicitar revisiones clínicas.';
      END IF;
      IF NEW.reviewer_id IS NULL OR NEW.reviewer_id = v_uid THEN
        RAISE EXCEPTION 'Elige a otro profesional como revisor.';
      END IF;
      IF NEW.review_requested_by IS DISTINCT FROM v_uid THEN
        RAISE EXCEPTION 'La solicitud de revisión debe registrarse a tu nombre.';
      END IF;
      v_reviewer_role := public.clinic_role_of(OLD.clinic_id, NEW.reviewer_id);
      IF v_reviewer_role IS NULL OR v_reviewer_role NOT IN ('owner','admin','dentist') THEN
        RAISE EXCEPTION 'El revisor debe ser doctor/a, administrador o propietario de la clínica.';
      END IF;

    ELSIF NEW.review_status IN ('approved','changes_requested') THEN
      IF OLD.review_status <> 'pending' THEN
        RAISE EXCEPTION 'Esta nota no está pendiente de aprobación.';
      END IF;
      IF NOT (v_reviewer OR v_manager) THEN
        RAISE EXCEPTION 'Solo el revisor asignado o un administrador puede resolver esta revisión.';
      END IF;
      IF NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id THEN
        RAISE EXCEPTION 'No se puede cambiar el revisor al resolver la revisión.';
      END IF;

    ELSIF NEW.review_status = 'none' THEN
      IF OLD.review_status = 'pending' AND NOT (v_requester OR v_manager OR v_reviewer) THEN
        RAISE EXCEPTION 'Solo quien solicitó la revisión, el revisor o un administrador puede cancelarla.';
      END IF;
      IF OLD.review_status <> 'pending' AND NOT (v_author OR v_manager OR v_role = 'dentist') THEN
        RAISE EXCEPTION 'Tu rol no puede limpiar el estado de revisión.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clinical_notes_enforce_update ON public.clinical_notes;
CREATE TRIGGER clinical_notes_enforce_update
BEFORE UPDATE ON public.clinical_notes
FOR EACH ROW EXECUTE FUNCTION public.enforce_clinical_note_update();

-- Solo roles clínicos que realmente pueden tocar la nota
DROP POLICY IF EXISTS notes_update_clinical ON public.clinical_notes;
CREATE POLICY notes_update_clinical ON public.clinical_notes
FOR UPDATE TO authenticated
USING (
  has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[])
  AND (
    created_by = auth.uid()
    OR reviewer_id = auth.uid()
    OR review_requested_by = auth.uid()
    OR has_clinic_role(clinic_id, ARRAY['owner','admin','dentist']::public.app_role[])
  )
)
WITH CHECK (
  has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[])
);

-- ---------------------------------------------------------------
-- clinical_note_reviews: la acción registrada debe ser legítima
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_note_review_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role public.app_role;
  v_manager boolean;
  n record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT clinic_id, patient_ref, reviewer_id, review_requested_by, review_status, created_by
    INTO n FROM public.clinical_notes WHERE id = NEW.note_id;
  IF n IS NULL THEN
    RAISE EXCEPTION 'No encontramos esa nota.';
  END IF;
  IF NEW.clinic_id IS DISTINCT FROM n.clinic_id OR NEW.patient_ref IS DISTINCT FROM n.patient_ref THEN
    RAISE EXCEPTION 'La revisión no coincide con la nota.';
  END IF;

  v_role := public.clinic_role_of(n.clinic_id, v_uid);
  IF v_role IS NULL OR v_role NOT IN ('owner','admin','dentist','assistant') THEN
    RAISE EXCEPTION 'Tu rol no participa en revisiones clínicas.';
  END IF;
  v_manager := v_role IN ('owner','admin');

  IF NEW.action IN ('approved','changes_requested') THEN
    IF NOT (n.reviewer_id = v_uid OR v_manager) THEN
      RAISE EXCEPTION 'Solo el revisor asignado o un administrador puede resolver esta revisión.';
    END IF;
  ELSIF NEW.action = 'cancelled' THEN
    IF NOT (n.review_requested_by = v_uid OR n.reviewer_id = v_uid OR v_manager) THEN
      RAISE EXCEPTION 'Solo quien solicitó la revisión puede cancelarla.';
    END IF;
  ELSIF NEW.action = 'requested' THEN
    IF NOT (n.review_requested_by = v_uid OR v_manager) THEN
      RAISE EXCEPTION 'No puedes registrar una solicitud de revisión a nombre de otra persona.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS note_reviews_enforce_insert ON public.clinical_note_reviews;
CREATE TRIGGER note_reviews_enforce_insert
BEFORE INSERT ON public.clinical_note_reviews
FOR EACH ROW EXECUTE FUNCTION public.enforce_note_review_insert();

-- ---------------------------------------------------------------
-- clinical_note_versions: no versionar notas firmadas o en revisión
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_note_version_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  n record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT clinic_id, status, review_status INTO n
    FROM public.clinical_notes WHERE id = NEW.note_id;
  IF n IS NULL THEN
    RAISE EXCEPTION 'No encontramos esa nota.';
  END IF;
  IF NEW.clinic_id IS DISTINCT FROM n.clinic_id THEN
    RAISE EXCEPTION 'La versión no coincide con la clínica de la nota.';
  END IF;
  IF n.status = 'signed' THEN
    RAISE EXCEPTION 'La nota está firmada: reábrela antes de guardar cambios.';
  END IF;
  IF n.review_status = 'pending' THEN
    RAISE EXCEPTION 'La nota está en revisión: no puede versionarse hasta resolverla.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS note_versions_enforce_insert ON public.clinical_note_versions;
CREATE TRIGGER note_versions_enforce_insert
BEFORE INSERT ON public.clinical_note_versions
FOR EACH ROW EXECUTE FUNCTION public.enforce_note_version_insert();

-- ---------------------------------------------------------------
-- notifications: solo a miembros de la misma clínica
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Crear notificaciones dentro de mi clinica" ON public.notifications;
CREATE POLICY "Crear notificaciones dentro de mi clinica" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  is_clinic_member(clinic_id)
  AND actor_id = auth.uid()
  AND is_clinic_member_of(clinic_id, recipient_id)
);