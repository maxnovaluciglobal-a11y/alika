-- product-3a (auditoría, impacto alto / esfuerzo bajo): `setQuoteStatus` solo
-- guardaba `accepted_by_name` como texto libre opcional cuando un presupuesto
-- pasaba a 'accepted' — sin ninguna evidencia técnica (IP, user-agent) del
-- momento del consentimiento, útil ante una disputa de cobro con el paciente.
--
-- `accepted_at` ya existe desde la creación de `quotes`
-- (20260812210000_b2c3d4e5-...). Esta migración solo agrega evidencia de
-- request al lado de esa columna existente.
alter table public.quotes
  add column accepted_ip inet,
  add column accepted_user_agent text;

comment on column public.quotes.accepted_ip is
  'IP del request HTTP en el momento en que status pasó a accepted (x-forwarded-for). Evidencia de consentimiento, no dato de contacto del paciente.';
comment on column public.quotes.accepted_user_agent is
  'User-agent del request HTTP en el momento en que status pasó a accepted. Evidencia de consentimiento junto con accepted_ip/accepted_at.';
