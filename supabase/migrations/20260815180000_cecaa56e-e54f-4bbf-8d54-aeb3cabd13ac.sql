-- Ambiente demo público de solo lectura.
--
-- Bloqueo a nivel de TRIGGER, no de RLS policy: cubrir esto en cada policy
-- de escritura (payments, quotes, treatment_items, clinical_notes...)
-- significaría tocar ~19 policies distintas y dejar la puerta abierta a
-- que una tabla nueva se olvide del chequeo. Un solo trigger reusable,
-- adjunto a cada tabla relevante, es más difícil de esquivar por error.
--
-- El trigger deja pasar `service_role`/`postgres` (para que un futuro job
-- de reset pueda reescribir los datos demo) y bloquea todo lo demás
-- (incluido el propio dueño/admin de la clínica demo) con una excepción.
--
-- NO SECURITY DEFINER a propósito: con SECURITY DEFINER, `current_user`
-- dentro de la función pasa a ser el dueño de la función (quien la creó),
-- no quien dispara el trigger — rompe la detección de service_role/postgres
-- vs. authenticated. `session_user` tampoco sirve (no refleja `SET ROLE`).
-- Verificado empíricamente el 2026-08-15 con `SET ROLE authenticated`.

ALTER TABLE public.clinics ADD COLUMN is_demo boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.block_demo_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
BEGIN
  IF current_user IN ('service_role', 'postgres') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_clinic_id := COALESCE(NEW.clinic_id, OLD.clinic_id);
  IF EXISTS (SELECT 1 FROM public.clinics WHERE id = v_clinic_id AND is_demo) THEN
    RAISE EXCEPTION 'Esta es la clínica demo — de solo lectura. Creá tu clínica real para guardar cambios.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'patients', 'appointments', 'waitlist_entries',
    'procedures', 'quotes', 'quote_items', 'treatment_plans', 'treatment_items', 'payments',
    'message_templates', 'messages',
    'clinical_notes', 'clinical_note_versions', 'clinical_note_reviews', 'clinical_note_entities',
    'odontogram_marks',
    'branches', 'operatories', 'professionals', 'specialties'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS block_demo_writes ON public.%I; '
      'CREATE TRIGGER block_demo_writes BEFORE INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.block_demo_writes()',
      t, t
    );
  END LOOP;
END $$;

-- La fila de `clinics` de la propia clínica demo también queda fija (nombre,
-- onboarding, etc.) — chequeo aparte porque clinics.id ES el clinic_id, no
-- tiene una columna clinic_id como las demás.
CREATE OR REPLACE FUNCTION public.block_demo_clinic_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres') THEN
    RETURN NEW;
  END IF;
  IF OLD.is_demo THEN
    RAISE EXCEPTION 'Esta es la clínica demo — de solo lectura.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER block_demo_clinic_update BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.block_demo_clinic_update();
