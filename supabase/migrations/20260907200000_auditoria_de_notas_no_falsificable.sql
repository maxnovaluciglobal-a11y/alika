-- ============================================================================
-- La auditoría de notas clínicas deja de ser falsificable.
--
-- Antes: la política `note_audit_insert_members` dejaba que CUALQUIER miembro
-- de la clínica insertara filas en `clinical_note_audit` con `action` y
-- `detail` arbitrarios, con la única condición de atribuírselas a sí mismo.
-- O sea que alguien podía fabricar un "aprobó la nota" o un "firmó" que nunca
-- ocurrió. Un registro de auditoría en el que cualquiera escribe lo que quiere
-- no es un registro de auditoría.
--
-- De las acciones que se auditan, hay dos clases distintas y hace falta
-- tratarlas distinto:
--
--   A. Hechos que la base CONOCE (se firmó, se revirtió, se aprobó una
--      revisión, se validó una entidad). Los escriben triggers a partir del
--      cambio real. La app deja de escribirlos.
--   B. Hechos que la base NO PUEDE VER (un choque de la cola offline, una
--      llamada al modelo de IA). No hay trigger posible. Pasan por una función
--      que sólo acepta ese vocabulario acotado y estampa el actor ella misma.
--
-- La política de INSERT abierta se elimina. Después de esta migración, lo peor
-- que puede inventar un usuario es "usé IA en esta nota" — nunca un hecho
-- sobre la integridad del registro clínico.
-- ============================================================================

-- ── 1. El origen de una versión pasa a ser un dato, no texto libre ──────────
-- "Revirtió a v3" vivía sólo dentro del `detail` de la auditoría, que es justo
-- lo que estamos dejando de creerle. Para que un trigger pueda distinguir un
-- guardado normal de una reversión, el hecho tiene que estar en la versión.

ALTER TABLE public.clinical_note_versions
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'save',
  ADD COLUMN IF NOT EXISTS origin_version integer;

ALTER TABLE public.clinical_note_versions
  DROP CONSTRAINT IF EXISTS clinical_note_versions_origin_check;
ALTER TABLE public.clinical_note_versions
  ADD CONSTRAINT clinical_note_versions_origin_check
  CHECK (origin IN ('save', 'revert'));

-- Una reversión sin decir de dónde vino no sirve; un guardado normal no tiene
-- de dónde venir.
ALTER TABLE public.clinical_note_versions
  DROP CONSTRAINT IF EXISTS clinical_note_versions_origin_coherente;
ALTER TABLE public.clinical_note_versions
  ADD CONSTRAINT clinical_note_versions_origin_coherente
  CHECK (
    (origin = 'revert' AND origin_version IS NOT NULL)
    OR (origin = 'save' AND origin_version IS NULL)
  );

-- ── 2. Vocabulario cerrado de acciones ─────────────────────────────────────
-- La tabla está vacía en producción, así que no hay historia que preservar.

ALTER TABLE public.clinical_note_audit
  DROP CONSTRAINT IF EXISTS clinical_note_audit_action_check;
ALTER TABLE public.clinical_note_audit
  ADD CONSTRAINT clinical_note_audit_action_check
  CHECK (action IN (
    -- Clase A: los escribe un trigger, nunca la app
    'create', 'edit', 'revert', 'sign', 'reopen',
    'entity_confirm', 'entity_delete',
    'review_requested', 'review_approved', 'review_changes_requested',
    'review_comment', 'review_cancelled',
    -- Clase B: los escribe registrar_evento_de_nota(), nunca un trigger
    'conflict', 'ai_draft', 'ai_summary', 'ai_polish', 'ai_structure'
  ));

-- ── 3. El escritor único de la auditoría ───────────────────────────────────
-- SECURITY DEFINER porque después de esta migración NADIE tiene permiso de
-- INSERT sobre la tabla por RLS. Es el único camino de escritura que queda.

CREATE OR REPLACE FUNCTION public.anotar_auditoria_de_nota(
  p_note_id uuid,
  p_clinic_id uuid,
  p_patient_ref text,
  p_action text,
  p_detail text,
  p_actor_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clinical_note_audit
    (note_id, clinic_id, patient_ref, action, detail, actor_id)
  VALUES
    (p_note_id, p_clinic_id, p_patient_ref, p_action, p_detail, p_actor_id);
END;
$$;

REVOKE ALL ON FUNCTION public.anotar_auditoria_de_nota(uuid, uuid, text, text, text, uuid) FROM PUBLIC;

-- ── 4. Trigger: se guardó una versión → create / edit / revert ──────────────

CREATE OR REPLACE FUNCTION public.auditar_version_de_nota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accion text;
  v_detalle text;
  v_patient_ref text;
BEGIN
  SELECT patient_ref INTO v_patient_ref
  FROM public.clinical_notes WHERE id = NEW.note_id;

  IF NEW.origin = 'revert' THEN
    v_accion := 'revert';
    v_detalle := format('Revirtió a v%s como nuevo borrador v%s',
                        NEW.origin_version, NEW.version);
  ELSIF NEW.version = 1 THEN
    v_accion := 'create';
    v_detalle := format('v%s', NEW.version);
  ELSE
    v_accion := 'edit';
    v_detalle := format('v%s', NEW.version);
  END IF;

  IF NEW.origin <> 'revert' AND NEW.ai_assisted THEN
    v_detalle := v_detalle || ' · con asistencia de IA';
  END IF;

  PERFORM public.anotar_auditoria_de_nota(
    NEW.note_id, NEW.clinic_id, coalesce(v_patient_ref, ''),
    v_accion, v_detalle, NEW.author_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS note_versions_auditar ON public.clinical_note_versions;
CREATE TRIGGER note_versions_auditar
  AFTER INSERT ON public.clinical_note_versions
  FOR EACH ROW EXECUTE FUNCTION public.auditar_version_de_nota();

-- ── 5. Trigger: cambió el estado de la nota → sign / reopen ─────────────────

CREATE OR REPLACE FUNCTION public.auditar_estado_de_nota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;

  PERFORM public.anotar_auditoria_de_nota(
    NEW.id, NEW.clinic_id, coalesce(NEW.patient_ref, ''),
    CASE WHEN NEW.status = 'signed' THEN 'sign' ELSE 'reopen' END,
    NULL,
    coalesce(NEW.updated_by, auth.uid()));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notes_auditar_estado ON public.clinical_notes;
CREATE TRIGGER notes_auditar_estado
  AFTER UPDATE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION public.auditar_estado_de_nota();

-- ── 6. Trigger: se registró una acción de revisión → review_* ───────────────

CREATE OR REPLACE FUNCTION public.auditar_revision_de_nota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.anotar_auditoria_de_nota(
    NEW.note_id, NEW.clinic_id, coalesce(NEW.patient_ref, ''),
    'review_' || NEW.action, NEW.comment, NEW.actor_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS note_reviews_auditar ON public.clinical_note_reviews;
CREATE TRIGGER note_reviews_auditar
  AFTER INSERT ON public.clinical_note_reviews
  FOR EACH ROW EXECUTE FUNCTION public.auditar_revision_de_nota();

-- ── 7. Triggers: entidades clínicas → entity_confirm / entity_delete ────────

CREATE OR REPLACE FUNCTION public.auditar_entidad_confirmada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.confirmed IS NOT DISTINCT FROM OLD.confirmed THEN
    RETURN NULL;
  END IF;

  PERFORM public.anotar_auditoria_de_nota(
    NEW.note_id, NEW.clinic_id, coalesce(NEW.patient_ref, ''),
    'entity_confirm',
    format('%s "%s"',
           CASE WHEN NEW.confirmed THEN 'Validó' ELSE 'Quitó validación de' END,
           NEW.term),
    coalesce(NEW.confirmed_by, auth.uid()));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS note_entities_auditar_confirm ON public.clinical_note_entities;
CREATE TRIGGER note_entities_auditar_confirm
  AFTER UPDATE ON public.clinical_note_entities
  FOR EACH ROW EXECUTE FUNCTION public.auditar_entidad_confirmada();

CREATE OR REPLACE FUNCTION public.auditar_entidad_borrada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.anotar_auditoria_de_nota(
    OLD.note_id, OLD.clinic_id, coalesce(OLD.patient_ref, ''),
    'entity_delete', OLD.term, auth.uid());
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS note_entities_auditar_delete ON public.clinical_note_entities;
CREATE TRIGGER note_entities_auditar_delete
  AFTER DELETE ON public.clinical_note_entities
  FOR EACH ROW EXECUTE FUNCTION public.auditar_entidad_borrada();

-- ── 8. Los hechos que la base no puede ver ──────────────────────────────────
-- Choques de la cola offline y llamadas al modelo de IA. No hay cambio de
-- estado que un trigger pueda observar, así que la app los reporta — pero por
-- una puerta angosta: sólo este vocabulario, y el actor lo estampa la función,
-- no el que llama.

-- Los parámetros opcionales van al final y con DEFAULT: `p_note_id` puede no
-- existir todavía (la IA se usa antes de que la nota exista), y si no lo
-- declaramos opcional los tipos generados lo marcan como obligatorio y no
-- nulable — el typecheck lo agarró.
CREATE OR REPLACE FUNCTION public.registrar_evento_de_nota(
  p_clinic_id uuid,
  p_action text,
  p_note_id uuid DEFAULT NULL,
  p_patient_ref text DEFAULT NULL,
  p_detail text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF p_action NOT IN ('conflict', 'ai_draft', 'ai_summary', 'ai_polish', 'ai_structure') THEN
    RAISE EXCEPTION 'accion % no se puede registrar desde la app: la escribe un trigger', p_action
      USING ERRCODE = '42501';
  END IF;

  IF v_actor IS NULL OR NOT public.is_clinic_member(p_clinic_id) THEN
    RAISE EXCEPTION 'sin permiso sobre esta clinica' USING ERRCODE = '42501';
  END IF;

  -- La nota, si viene, tiene que ser de esa clínica: si no, se podría ensuciar
  -- el historial de una nota ajena desde una clínica propia.
  IF p_note_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clinical_notes
    WHERE id = p_note_id AND clinic_id = p_clinic_id
  ) THEN
    RAISE EXCEPTION 'la nota no pertenece a esta clinica' USING ERRCODE = '42501';
  END IF;

  PERFORM public.anotar_auditoria_de_nota(
    p_note_id, p_clinic_id, coalesce(p_patient_ref, ''), p_action, p_detail, v_actor);
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_evento_de_nota(uuid, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_evento_de_nota(uuid, text, uuid, text, text) TO authenticated;

-- ── 9. Se cierra la puerta ancha ───────────────────────────────────────────
-- Sin esto todo lo anterior es decorativo: la política vieja seguiría dejando
-- escribir cualquier fila directamente.

DROP POLICY IF EXISTS note_audit_insert_members ON public.clinical_note_audit;

COMMENT ON TABLE public.clinical_note_audit IS
  'Auditoría de notas clínicas. Sin política de INSERT a propósito: los hechos de la base los escriben triggers vía anotar_auditoria_de_nota(), y los de la app pasan por registrar_evento_de_nota(), que sólo acepta conflict/ai_*. Ningún usuario puede insertar directamente.';
