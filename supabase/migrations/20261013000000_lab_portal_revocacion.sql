-- Auditoría de seguridad 10-oct-2026 — portal externo de laboratorio.
--
-- Los links del portal (`/portal-laboratorio/<jwt>`) no tenían forma de
-- cortarse antes de vencer (90 días, ahora 30). Mismo patrón que
-- `patients.portal_revoked_at` del portal del paciente: todo token con `iat`
-- anterior o igual a esta marca deja de valer. Además, la app ahora rechaza
-- los tokens de laboratorios con `is_active = false`.
--
-- Sin policy nueva: la escritura la cubre `labs_update_managers`
-- (can_manage_clinic) y la lectura del portal la hace service_role.
-- Idempotente.

alter table public.labs add column if not exists portal_revoked_at timestamptz;

comment on column public.labs.portal_revoked_at is
  'Revocación del portal externo del laboratorio: los tokens con iat <= este valor dejan de valer.';
