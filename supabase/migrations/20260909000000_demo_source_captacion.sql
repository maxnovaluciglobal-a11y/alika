-- Agrega 'demo' como source válido de marketing_leads.
--
-- Antes de esto, /demo hacía auto-login sin pedir ningún contacto (Walter,
-- 08-sep-2026: "no hay ningún esfuerzo para capturar correo"). Mismo
-- criterio que ya se aplicó en DypOS (commit 262c51a, 08-sep-2026): el
-- visitante deja nombre+email antes de ver el panel demo. La migración
-- original (20260908010000_captacion_marketing_leads.sql) ya está aplicada
-- en producción, así que la corrección va acá — nunca se edita una
-- migración ya aplicada.
alter table public.marketing_leads
  drop constraint marketing_leads_source_valido;

alter table public.marketing_leads
  add constraint marketing_leads_source_valido
    check (source in ('calculadora', 'checklist', 'benchmark', 'demo'));
