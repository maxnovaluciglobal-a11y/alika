-- Ronda de fix final (revisión de rama, Important #3): `leads.functions.ts`
-- insertaba un evento "lead_enviado" en `marketing_events` para CADA intento
-- que pasa el honeypot (antes del rate-limit, Task 3 fix round) — pero
-- `lead-form.tsx` TAMBIÉN dispara `registrarEvento("lead_enviado", ...)`
-- desde el cliente cuando el submit tiene éxito (Task 6). Resultado: cada
-- envío exitoso generaba 2 filas con el mismo nombre y props distintos, y
-- cada intento fallido/bloqueado 1 — cualquier conteo del embudo real
-- quedaba mal.
--
-- El evento server-side que cuenta intentos para el rate limiter pasa a
-- llamarse "lead_intento", distinto de la conversión real ("lead_enviado",
-- que sigue siendo sólo del cliente). Sólo se agrega al CHECK — el cliente
-- (api.ev.ts / eventos.ts) nunca emite "lead_intento", así que no hace falta
-- tocar esos archivos.
alter table public.marketing_events
  drop constraint marketing_events_name_valido;

alter table public.marketing_events
  add constraint marketing_events_name_valido
    check (name in ('calculadora_vista', 'calculadora_usada', 'lead_enviado', 'cta_click', 'lead_intento'));
