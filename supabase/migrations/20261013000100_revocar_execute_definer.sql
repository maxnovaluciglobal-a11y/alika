-- Auditoría de seguridad 10-oct-2026 — EXECUTE sobrante en funciones
-- SECURITY DEFINER (segunda pasada de 20261007000000).
--
-- 1. Funciones de trigger (todas sin argumentos, RETURNS trigger, SECURITY
--    DEFINER; verificado en las migraciones). PostgREST no las expone por
--    /rest/v1/rpc, pero seguían con EXECUTE para PUBLIC/anon/authenticated
--    (default privileges de Supabase) y aparecen en `supabase db advisors`.
--    Revocar es seguro: Postgres chequea EXECUTE sobre la función del trigger
--    al hacer CREATE TRIGGER, no cada vez que el trigger dispara. Ninguna se
--    llama con `.rpc(` desde src/.
--
-- 2. Helpers de RLS:
--    - misma_clinica_agreement / misma_clinica_procedure: la política
--      `agreement_coverage_write_managers` los evalúa con el rol del usuario
--      → se mantiene `authenticated`, se quita PUBLIC y anon.
--    - is_clinic_member_of: la política de INSERT de `notifications` lo usa
--      (with check ... is_clinic_member_of(clinic_id, recipient_id)) → se
--      mantiene `authenticated`, se quita PUBLIC y anon.
--
-- Idempotente: REVOKE/GRANT repetidos no fallan, y cada función se busca
-- con to_regprocedure para que una ausente no tire abajo la migración.

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.aplicar_moneda_de_la_clinica()',
    'public.apply_inventory_movement()',
    'public.auditar_entidad_borrada()',
    'public.auditar_entidad_confirmada()',
    'public.auditar_estado_de_nota()',
    'public.auditar_revision_de_nota()',
    'public.auditar_version_de_nota()',
    'public.bloquear_bodega_con_saldo()',
    'public.close_previous_odontogram_mark()',
    'public.convert_accepted_quote_to_plan()',
    'public.enforce_patient_consent_update()',
    'public.enforce_patient_document_update()',
    'public.log_patient_medical_history_change()',
    'public.reset_patient_confirmation_on_reschedule()',
    'public.respetar_preferencia_de_avisos()',
    'public.seed_clinic_appointment_statuses()'
  ]
  LOOP
    IF to_regprocedure(f) IS NULL THEN
      RAISE NOTICE 'revocar_execute_definer: % no existe, se omite', f;
      CONTINUE;
    END IF;
    IF pg_get_function_result(to_regprocedure(f)) <> 'trigger' THEN
      RAISE EXCEPTION 'revocar_execute_definer: % no devuelve trigger, revisar antes de revocar', f;
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;

  FOREACH f IN ARRAY ARRAY[
    'public.misma_clinica_agreement(uuid, uuid)',
    'public.misma_clinica_procedure(uuid, uuid)',
    'public.is_clinic_member_of(uuid, uuid)'
  ]
  LOOP
    IF to_regprocedure(f) IS NULL THEN
      RAISE NOTICE 'revocar_execute_definer: % no existe, se omite', f;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;
