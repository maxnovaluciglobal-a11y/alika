-- Wave B · Skeleton de billing con Stripe
--
-- Modelo simplificado v1:
--   - Una `subscription` por clínica (no per-seat, no add-ons).
--   - Estado espejado de Stripe (trialing, active, past_due, canceled...).
--   - Ledger de eventos idempotente por `stripe_events(id)` para procesar
--     webhook una sola vez.
--
-- La cuenta Stripe la crea Walter con la LLC USA. Los product/price IDs
-- se meten como env vars (STRIPE_PRICE_ID_CLINIC_MONTHLY) — el server
-- solo referencia el id, no hardcodea nada.

CREATE TABLE public.subscriptions (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  -- Espejo del enum de Stripe (trialing / active / past_due / canceled /
  -- unpaid / incomplete / incomplete_expired / paused).
  status text NOT NULL DEFAULT 'incomplete',
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_status_idx ON public.subscriptions(status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.subscriptions TO authenticated;

-- Todo miembro ve la suscripción de su clínica (para banners de trial,
-- expiración, upgrade). Solo owner/admin la modifica desde la app, pero
-- las escrituras reales vienen del webhook con service_role.
CREATE POLICY "subscriptions_select_members" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));

CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Ledger idempotente de eventos Stripe.
-- ─────────────────────────────────────────────────────────────
-- Stripe reintenta webhooks hasta ~3 días si no responden 200. Sin
-- idempotencia se pueden procesar el mismo checkout.session.completed
-- 2 veces y duplicar la suscripción.
CREATE TABLE public.stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  raw jsonb
);

CREATE INDEX stripe_events_type_idx ON public.stripe_events(type, received_at DESC);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- Nadie desde `authenticated` lee ni escribe. Solo service_role via
-- webhook endpoint (que corre con SUPABASE_SERVICE_ROLE_KEY).
-- Sin policy = sin acceso.

-- ─────────────────────────────────────────────────────────────
-- Helper: la clínica tiene suscripción activa?
-- ─────────────────────────────────────────────────────────────
-- Se usa en middleware de rutas administrativas para bloquear acceso
-- cuando la sub está past_due/canceled/etc.
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE clinic_id = p_clinic_id
      AND status IN ('trialing', 'active')
      AND (current_period_end IS NULL OR current_period_end > now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated;
