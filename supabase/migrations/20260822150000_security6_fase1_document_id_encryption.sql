-- security-6 Fase 1 (auditoría 360, cifrado de PII/PHI) — SOLO patients.document_id,
-- el campo de mayor sensibilidad (RUT/cédula/pasaporte) y menor superficie de uso
-- en el código. Ver docs/SECURITY6_CIFRADO_PLAN.md para el plan completo y por
-- qué NO se cifra patients entera de una.
--
-- ⚠️ ANTES de correr el resto de este archivo, generar la clave UNA VEZ en el
-- SQL Editor (reemplazar el comentario, no correrlo dos veces o se pierde
-- acceso a lo ya cifrado con la clave vieja):
--
--   select vault.create_secret(encode(gen_random_bytes(32),'hex'), 'alika_document_id_key');
--
-- Confirmar que quedó:
--   select name from vault.decrypted_secrets where name = 'alika_document_id_key';
--
-- Enfoque: cifrado (pgp_sym_encrypt, recuperable) + HMAC-SHA256 determinístico
-- como "blind index" para el dedup por igualdad que ya usa importPatients —
-- NO cifrado determinístico directo del valor (eso es vulnerable a análisis de
-- frecuencia si alguien tiene acceso de lectura a la tabla).
--
-- ESTRATEGIA DE ROLLOUT — doble escritura, sin cortar nada todavía:
-- `document_id` (texto plano) sigue existiendo y siendo la fuente de verdad
-- para lecturas/dedup HOY. Esta migración solo agrega las columnas nuevas y
-- las funciones para empezar a escribir en paralelo. El corte real (que la
-- app lea SOLO de document_id_enc y se borre el texto plano) es una fase
-- aparte, deliberadamente NO incluida acá — necesita validar primero que el
-- cifrado nuevo se está poblando bien antes de depender de él.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS document_id_enc bytea,
  ADD COLUMN IF NOT EXISTS document_id_hash text;

CREATE INDEX IF NOT EXISTS patients_document_id_hash_idx
  ON public.patients (clinic_id, document_id_hash);

COMMENT ON COLUMN public.patients.document_id_enc IS
  'RUT/cédula/pasaporte cifrado (pgp_sym_encrypt, clave en Vault). Fase 1 de security-6 — escritura en paralelo a document_id (texto plano), NO es todavía la fuente de verdad de lectura.';
COMMENT ON COLUMN public.patients.document_id_hash IS
  'HMAC-SHA256 de document_id normalizado (blind index) — permite dedup/búsqueda por igualdad sin exponer el valor cifrado a análisis de frecuencia.';

-- SECURITY DEFINER: authenticated no tiene (ni debe tener) permiso directo
-- de leer vault.decrypted_secrets — solo esta función, acotada a esta clave.
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
    JOIN public.clinic_members m ON m.clinic_id = p.clinic_id
    WHERE p.id = p_patient_id AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para modificar este paciente.';
  END IF;

  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'alika_document_id_key';
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Falta la clave alika_document_id_key en Vault — generarla antes de usar esta función (ver comentario al inicio de esta migración).';
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

GRANT EXECUTE ON FUNCTION public.set_patient_document_id(uuid, text) TO authenticated;

-- Lectura descifrada bajo demanda — NO se usa todavía desde el código de la
-- app (Fase 1 sigue leyendo del texto plano), queda lista para la Fase 1b.
CREATE OR REPLACE FUNCTION public.get_patient_document_id(p_patient_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
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

GRANT EXECUTE ON FUNCTION public.get_patient_document_id(uuid) TO authenticated;
