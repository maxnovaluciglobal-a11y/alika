-- Task 13 (Fase 3, última tarea): descarga gateada del PDF del checklist.
--
-- El brief original pedía "un token de descarga de un solo uso ligado al
-- lead", pero un JWT firmado sin más es válido durante todo su TTL — no es
-- de un solo uso. Hace falta estado persistido que se invalide al primer
-- uso. Mismo patrón exacto que `unsubscribe_token` (Task 1, migración
-- 20260908010000): random de 16 bytes en hex vía default, el cliente nunca
-- lo genera ni lo elige.
--
-- `download_delivered_at` null = todavía no se descargó nada. El endpoint
-- (src/routes/api.recurso.$slug.ts) hace un UPDATE ... WHERE
-- download_delivered_at IS NULL atómico contra esta fila — eso, y no una
-- lectura seguida de una escritura separada, es lo que hace el "de un solo
-- uso" seguro ante dos requests concurrentes con el mismo token.
alter table public.marketing_leads
  add column download_token text unique default encode(gen_random_bytes(16), 'hex'),
  add column download_delivered_at timestamptz;
