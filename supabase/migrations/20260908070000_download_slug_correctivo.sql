-- Ronda de fix final (revisión de rama, Important #2): `source` en
-- `marketing_leads` cumple doble propósito — Task 3 lo diseñó para que la
-- ÚLTIMA fuente gane en cada envío (comportamiento intencional), pero
-- `api.recurso.$slug.ts` lo reusaba como parte de la autorización del token
-- de descarga (`.eq("source", recurso.source)`). Si un lead llena el
-- checklist (recibe token, source='checklist') y DESPUÉS llena la
-- calculadora sin haber descargado todavía, `source` pasa a 'calculadora' y
-- el link de descarga (con el token todavía sin usar) da 403 para siempre.
--
-- Columna nueva, independiente de `source`: se setea UNA sola vez al INSERT
-- de un lead source='checklist' (mismo criterio que `consent_at`/
-- `consent_text` — evidencia que `datosActualizacion` en leads.functions.ts
-- nunca pisa en updates posteriores) y autoriza la descarga sin depender de
-- qué fuente ganó más tarde. Nullable: sólo los leads que efectivamente
-- pidieron un recurso con token lo tienen.
alter table public.marketing_leads
  add column download_slug text;
