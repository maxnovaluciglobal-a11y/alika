-- Correos de ciclo de vida para la clínica (09-oct-2026).
--
-- Registro e idempotencia de cada correo que Esmalia le manda a la CLÍNICA
-- (dueños y administradores): bienvenida, aviso de fin de prueba (T-3 y T-0),
-- suscripción activa, pago fallido y el reporte semanal. Ningún proceso
-- automático le escribe a pacientes; esta tabla no tiene cómo guardar uno.
--
-- La clave natural es (clinic_id, kind, period_key, recipient):
--   * welcome             → period_key = 'once'
--   * trial_t3 / trial_t0 → la fecha local de fin del trial (YYYY-MM-DD)
--   * subscription_active → el id de la suscripción de Stripe
--   * payment_failed      → el id de la factura de Stripe
--   * weekly_report       → el lunes de la semana reportada (YYYY-MM-DD)
-- El código "reclama" el envío insertando la fila en 'pending' ANTES de llamar
-- a Resend; si el INSERT choca con el UNIQUE, otro proceso ya lo hizo (o lo
-- está haciendo) y no se manda nada. Un 'error' se puede reintentar hasta
-- `attempts = 3`.
--
-- Acceso: solo el rol de servicio (el cron y el webhook de Stripe). RLS activa
-- y SIN políticas, igual que `stripe_events`: desde `authenticated` no se lee
-- ni se escribe nada. Además se revocan los privilegios de tabla para que ni
-- un cambio futuro de política la abra por accidente.

CREATE TABLE IF NOT EXISTS public.lifecycle_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (
    kind IN (
      'welcome',
      'trial_t3',
      'trial_t0',
      'subscription_active',
      'payment_failed',
      'weekly_report'
    )
  ),
  period_key text NOT NULL CHECK (length(period_key) BETWEEN 1 AND 200),
  -- Siempre en minúsculas: dos mayúsculas distintas no son dos destinatarios.
  recipient text NOT NULL CHECK (recipient = lower(recipient)),
  -- Quién es el destinatario dentro de Esmalia (para la baja). NULL si la
  -- cuenta se borró después del envío: el registro sobrevive a la persona.
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'skipped', 'error')),
  error text,
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts >= 1),
  -- Modo de prueba (LIFECYCLE_EMAIL_REDIRECT_TO): a dónde fue en realidad.
  redirected_to text,
  -- Id del correo en Resend, para rastrearlo en su panel.
  provider_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lifecycle_emails_unico UNIQUE (clinic_id, kind, period_key, recipient)
);

CREATE INDEX IF NOT EXISTS lifecycle_emails_kind_created_idx
  ON public.lifecycle_emails (kind, created_at DESC);

CREATE INDEX IF NOT EXISTS lifecycle_emails_user_idx
  ON public.lifecycle_emails (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.lifecycle_emails ENABLE ROW LEVEL SECURITY;
-- Sin policy = sin acceso para anon y authenticated. Solo service_role.
REVOKE ALL ON public.lifecycle_emails FROM anon, authenticated;

COMMENT ON TABLE public.lifecycle_emails IS
  'Correos de ciclo de vida enviados a la clínica (nunca a pacientes). Idempotencia por (clinic_id, kind, period_key, recipient). Solo service_role.';
