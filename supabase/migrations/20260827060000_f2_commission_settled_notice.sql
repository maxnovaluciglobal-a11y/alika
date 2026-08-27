-- Auditoría 360 v2 (26-ago-2026), área Comunicaciones — F2, parte 1 de 2.
--
-- Comisiones liquidadas no generaban ningún aviso al profesional (ni email,
-- ni WhatsApp, ni toast persistente) — cerrar un período con
-- `closeCommissionPeriod` congelaba el snapshot en `commission_settlements`
-- pero el profesional no se enteraba nunca por fuera de entrar a mirar
-- /comisiones a mano.
--
-- Valor de enum solo, separado de la parte 2 (seed + backfill) porque
-- Postgres no permite usar un valor de `ALTER TYPE ... ADD VALUE` en la
-- misma transacción en que se agregó — mismo criterio que 20260816120000.

ALTER TYPE public.message_template_kind ADD VALUE IF NOT EXISTS 'commission_settled';
