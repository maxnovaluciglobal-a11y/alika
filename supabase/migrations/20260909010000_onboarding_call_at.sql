-- Gate de features avanzadas desde el día 1 del trial.
--
-- A diferencia de trialInformesBloqueados (bloquea informes al día 15), este
-- gate aplica desde el alta: WhatsApp automático, portal del paciente, y
-- /efectividad requieren agendar una llamada de 15 min (onboarding) o
-- suscribirse ya. Dos salidas, las dos reales — ver billing.ts,
-- `requiereLlamadaOSuscripcion()`.
alter table public.clinics add column onboarding_call_at timestamptz null;

comment on column public.clinics.onboarding_call_at is
  'Cuándo se agendó/hizo la llamada de puesta en marcha. null = no agendó. Ver requiereLlamadaOSuscripcion() en billing.ts.';
