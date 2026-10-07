-- Auditoría de seguridad 06/07-oct-2026 (`supabase db advisors`).
--
-- En Supabase, `anon` y `authenticated` reciben EXECUTE directo sobre toda
-- función nueva de `public` (default privileges). Un `REVOKE ... FROM PUBLIC`
-- NO les quita ese permiso: solo quita el del pseudo-rol PUBLIC. Por eso la
-- migración 20260907200000 ("auditoría de notas no falsificable") dejaba
-- `anotar_auditoria_de_nota` llamable por /rest/v1/rpc con la clave pública:
-- cualquiera podía insertar entradas de auditoría con actor y acción
-- inventados, justo lo que esa migración quería impedir.
--
-- Qué se revoca y por qué es seguro (dependientes verificados en la base):
--
-- 1. anotar_auditoria_de_nota → anon y authenticated. Solo la llaman los 5
--    triggers auditar_* y registrar_evento_de_nota, todos SECURITY DEFINER:
--    corren como el dueño, no como el usuario.
-- 2. reset_demo_clinic → anon y authenticated. La llama solo el servidor con
--    service_role (src/lib/demo.functions.ts, src/routes/api.demo-reset.ts).
--    Hoy cualquier visitante podía resetear la clínica demo a voluntad.
-- 3. misma_clinica_agreement / misma_clinica_procedure → solo anon.
--    `authenticated` se mantiene: la política RLS
--    agreement_coverage_write_managers la evalúa con el rol del usuario.
-- 4. El resto de las SECURITY DEFINER llamables por RPC → solo anon.
--
-- Además, search_path fijo en las dos funciones que lo tenían mutable
-- (lint 0011). Ambas usan solo nombres calificados o del catálogo.

REVOKE EXECUTE ON FUNCTION public.anotar_auditoria_de_nota(uuid, uuid, text, text, text, uuid)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.reset_demo_clinic() FROM anon, authenticated;

-- 3 y 4. Funciones llamables que nunca usa un visitante sin login: se quita
-- PUBLIC (de ahí lo heredaba anon) y anon, y se re-otorga explícito a los
-- dos roles que sí las usan. Todas validan identidad por dentro; esto es
-- defensa en profundidad, no un agujero abierto. Las funciones de trigger no
-- se tocan: PostgREST no expone funciones que devuelven `trigger`.
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.misma_clinica_agreement(uuid, uuid)',
    'public.misma_clinica_procedure(uuid, uuid)',
    'public.can_confirm_appointment(uuid, uuid)',
    'public.get_patient_document_id(uuid)',
    'public.has_active_subscription(uuid)',
    'public.list_patients_with_last_and_next_appointment(uuid)',
    'public.merge_patients(uuid, uuid, uuid)',
    'public.next_clinic_counter(uuid, text, integer)',
    'public.registrar_evento_de_nota(uuid, text, uuid, text, text)',
    'public.set_patient_document_id(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

ALTER FUNCTION public.generate_patient_referral_code() SET search_path = public;
ALTER FUNCTION public.storage_clinic_id_of(text) SET search_path = public;
