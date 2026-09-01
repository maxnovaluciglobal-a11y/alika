-- Auditoría de código 01-sep-2026 (dimensión arquitectura/seguridad de código).
-- Dos de los tres hallazgos de "SECURITY DEFINER sin el mismo resguardo que
-- sus hermanas" se corrigen acá. El tercero (is_clinic_member_of expuesta a
-- authenticated mientras su gemela clinic_role_of no lo está) se investigó y
-- se descartó a propósito: is_clinic_member_of la usa en vivo la policy
-- "Crear notificaciones dentro de mi clinica" (WITH CHECK) sobre
-- public.notifications — un REVOKE ahí rompería esa policy, porque el rol
-- `authenticated` necesita EXECUTE sobre cualquier función que su propia
-- policy invoque directamente (no aplica la excepción de SECURITY DEFINER,
-- que solo cubre llamadas hechas DESDE ADENTRO de otra función, no la
-- invocación inicial). Arreglarlo de verdad requiere reescribir esa policy
-- para no depender de una función invocable por RPC directo — fuera de
-- alcance de este fix puntual, queda para una sesión dedicada.

-- 1) has_active_subscription: sus dos hermanas SECURITY DEFINER creadas el
-- mismo día (next_clinic_counter, list_patients_with_last_and_next_appointment)
-- validan is_clinic_member antes de devolver nada; esta no. Sin caller real
-- en el código de la app hoy (confirmado por grep) — el fix es puro
-- hardening preventivo, no corrige un bug en uso.
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_clinic_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_clinic_member(p_clinic_id) THEN
    RAISE EXCEPTION 'No tienes permisos para consultar esta clínica.';
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE clinic_id = p_clinic_id
      AND status IN ('trialing', 'active')
      AND (current_period_end IS NULL OR current_period_end > now())
  );
END;
$$;

-- 2) set_patient_document_id: solo validaba membresía, no rol — más laxo que
-- "patients_update_front_desk" (la policy que gatea el UPDATE normal del
-- mismo dato en texto plano, restringida a owner/admin/dentist/reception,
-- excluye assistant/accounting). En el flujo real de la app esto es
-- invisible: createPatient/updatePatient/importPatients solo llegan a este
-- RPC después de que el UPDATE en texto plano ya tuvo éxito bajo esa misma
-- policy — o sea, quien llega hasta acá ya demostró tener uno de esos 4
-- roles. El gap real es la invocación DIRECTA del RPC (sin pasar por
-- updatePatient), que hoy no chequea rol en absoluto.
CREATE OR REPLACE FUNCTION public.set_patient_document_id(p_patient_id uuid, p_document_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_key text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = p_patient_id
      AND public.has_clinic_role(p.clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[])
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para modificar este paciente.';
  END IF;

  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'alika_document_id_key';
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Falta la clave alika_document_id_key en Vault — generarla antes de usar esta función (ver comentario al inicio de supabase/migrations/20260822150000_security6_fase1_document_id_encryption.sql).';
  END IF;

  UPDATE public.patients
  SET
    document_id_enc = CASE WHEN p_document_id IS NULL OR btrim(p_document_id) = '' THEN NULL
                            ELSE pgp_sym_encrypt(p_document_id, v_key) END,
    document_id_hash = CASE WHEN p_document_id IS NULL OR btrim(p_document_id) = '' THEN NULL
                             ELSE encode(hmac(lower(btrim(p_document_id)), v_key, 'sha256'), 'hex') END
  WHERE id = p_patient_id;
END;
$$;
