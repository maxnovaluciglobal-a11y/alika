-- Ronda de fix 1 sobre Task 13 (revisión rigurosa, minor): `download_token`
-- (migración 20260908050000) quedó nullable por descuido — `unsubscribe_token`
-- (Task 1, migración 20260908010000), la columna con el mismo patrón exacto
-- de "random en hex vía default, nunca elegido por el cliente", sí es
-- `not null`. Segura de aplicar sin backfill: el DEFAULT de la migración
-- anterior usa `gen_random_bytes` (volátil), así que Postgres reescribió la
-- tabla entera calculando un valor real por fila cuando corrió el
-- `ADD COLUMN` — no puede haber quedado ningún NULL.
alter table public.marketing_leads
  alter column download_token set not null;
