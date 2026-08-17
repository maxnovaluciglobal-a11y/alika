-- Validación de teléfono (Numverify) — informativo, nunca bloquea.
-- NULL = nunca se llegó a validar (sin key, Numverify caído, o el campo
-- estaba vacío). true/false = Numverify confirmó (o no) que el número tiene
-- forma real. Mismo criterio que saldo/no_show_risk/ai_summary (regla 11 del
-- CLAUDE.md): placeholder nullable, la UI muestra "sin dato" cuando es NULL,
-- nunca lo trata como inválido.
alter table public.patients
  add column phone_valid boolean null;
