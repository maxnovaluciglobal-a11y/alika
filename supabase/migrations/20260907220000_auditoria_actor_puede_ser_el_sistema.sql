-- La auditoría de notas registra las acciones del sistema en vez de bloquearlas.
--
-- Hallazgo al revisar la migración 20260907200000 del mismo día:
-- `clinical_note_audit.actor_id` es NOT NULL, y dos de los triggers pueden
-- pasarle NULL cuando no hay identidad (rol de servicio, cascada, un script).
-- Resultado: la fila de auditoría fallaba y **arrastraba la operación entera**.
--
-- Reproducido contra la réplica, sin JWT, los tres casos fallaban:
--   (1) UPDATE del estado de una nota con `updated_by` nulo,
--   (2) DELETE de una entidad clínica,
--   (3) DELETE de una NOTA con entidades — la cascada dispara (2).
--
-- El (3) es el peligroso: `reset_demo_clinic()` corre como SECURITY DEFINER sin
-- JWT, y hoy sobrevive sólo porque la clínica demo tiene 0 entidades. El día
-- que el seed sembrara una, el reset diario se caía.
--
-- ⭐ El criterio: **un registro de auditoría que impide borrar una nota dejó de
-- ser un registro y pasó a ser un candado.** Es preferible anotar "esto lo hizo
-- el sistema" que bloquear la operación o —peor— saltear la anotación en
-- silencio. La propiedad de seguridad no se toca: nadie puede FABRICAR una fila
-- que le atribuya algo a otra persona, porque no hay política de INSERT y
-- `registrar_evento_de_nota()` sigue exigiendo `auth.uid()`.

ALTER TABLE public.clinical_note_audit ALTER COLUMN actor_id DROP NOT NULL;

COMMENT ON COLUMN public.clinical_note_audit.actor_id IS
  'Quién hizo la acción. NULL = la hizo el sistema (rol de servicio, borrado en cascada, script de mantenimiento), no una persona. Se registra sin actor antes que bloquear la operación.';

-- ── Segundo hallazgo, del mismo trigger y más grave ─────────────────────────
-- Borrar una nota clínica con entidades era IMPOSIBLE, para cualquiera:
--   DELETE de la nota → cascada borra sus entidades → dispara este trigger →
--   intenta anotar la auditoría referenciando la nota que se está borrando →
--   `clinical_note_audit_note_id_fkey` lo rechaza (23503).
--
-- `clinical_notes` cascadea desde `clinics`, así que esto se disparaba al
-- **borrar una clínica** — exactamente lo que hay pendiente hacer con las 4
-- filas duplicadas de "Clinica Maxnova".
--
-- La entidad borrada se sigue registrando, pero sin referencia a la nota
-- (`note_id` ya es nullable): cuando la nota entera desaparece, el borrado de
-- cada entidad es consecuencia de eso, no un acto independiente. Anotar sin la
-- referencia es honesto; perderlo en silencio o bloquear el borrado, no.

CREATE OR REPLACE FUNCTION public.auditar_entidad_borrada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_note_id uuid;
BEGIN
  -- Si la nota ya no está, se anota igual pero sin apuntarla: la FK no admite
  -- una referencia a una fila que se está borrando en la misma sentencia.
  SELECT id INTO v_note_id FROM public.clinical_notes WHERE id = OLD.note_id;

  PERFORM public.anotar_auditoria_de_nota(
    v_note_id, OLD.clinic_id, coalesce(OLD.patient_ref, ''),
    'entity_delete', OLD.term, auth.uid());
  RETURN NULL;
END;
$$;
