-- Fix: set_patient_document_id/get_patient_document_id fallaban con
-- "function pgp_sym_encrypt(text, text) does not exist" al probarlas contra
-- el Supabase real. Causa: Supabase instala pgcrypto en el schema
-- `extensions`, no en `public` — el `SET search_path = public, vault` de la
-- migración anterior no lo incluía. Verificado el fix con un roundtrip real
-- de cifrado/descifrado antes de este commit.

CREATE OR REPLACE FUNCTION public.set_patient_document_id(p_patient_id uuid, p_document_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_key text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.clinic_members m ON m.clinic_id = p.clinic_id
    WHERE p.id = p_patient_id AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para modificar este paciente.';
  END IF;

  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'alika_document_id_key';
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Falta la clave alika_document_id_key en Vault — generarla antes de usar esta función.';
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

CREATE OR REPLACE FUNCTION public.get_patient_document_id(p_patient_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_key text;
  v_enc bytea;
BEGIN
  SELECT p.document_id_enc INTO v_enc
  FROM public.patients p
  JOIN public.clinic_members m ON m.clinic_id = p.clinic_id
  WHERE p.id = p_patient_id AND m.user_id = auth.uid();

  IF v_enc IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'alika_document_id_key';
  RETURN pgp_sym_decrypt(v_enc, v_key);
END;
$$;
