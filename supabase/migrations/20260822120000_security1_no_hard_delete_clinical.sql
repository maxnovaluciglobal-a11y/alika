-- security-1 (auditoría 360, 2026-08-21): la historia clínica se podía borrar
-- en duro. clinical_notes y odontogram_marks ya están construidas sobre un
-- patrón de versionado inmutable (nunca UPDATE, siempre INSERT + trigger que
-- cierra la versión anterior) — el permiso de DELETE contradice ese propio
-- diseño y viola la Ley 20.584 art.13 + DS41 (retención mínima 15 años,
-- vigente hoy en Chile). Nadie usa este DELETE por diseño: no se pierde
-- ninguna funcionalidad real al sacarlo, incluido el riesgo de que el propio
-- founder (owner de la clínica piloto real) borre algo sin querer durante su
-- uso diario de la cuenta.
--
-- Defensa en profundidad: se saca tanto la policy de RLS como el GRANT de
-- DELETE para `authenticated`. `service_role` mantiene DELETE (GRANT ALL ya
-- existente) para operaciones administrativas legítimas (ej. reset de la
-- clínica demo, migraciones futuras) — esto no le da ese permiso a ningún
-- usuario de la app, incluido el owner.

DROP POLICY IF EXISTS "notes_delete_managers" ON public.clinical_notes;
DROP POLICY IF EXISTS "odontogram_delete_managers" ON public.odontogram_marks;

REVOKE DELETE ON public.clinical_notes FROM authenticated;
REVOKE DELETE ON public.odontogram_marks FROM authenticated;
