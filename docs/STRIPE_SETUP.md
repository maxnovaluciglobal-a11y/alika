# Setup de Stripe — Alika

Pasos que necesita hacer Walter para activar el billing skeleton ya wireado en el código (`13c2d27` → Wave B). Una vez completado, la app cobra a las clínicas automáticamente.

## Prerrequisito: pricing decidido

Antes de crear productos en Stripe, definir:
- **Modelo**: flat / per-seat / híbrido.
- **Precio**: USD/mes (o local). Referencia LatAm dental: Dentalink ~US$50-100/mes por clínica.
- **Trial**: hoy hardcoded a 14 días (`billing.functions.ts:107`). Cambiar ahí si querés más/menos.
- **Ciclos adicionales**: anual con descuento, add-ons por sucursal, etc. (opcional).

## 1. Cuenta Stripe

- Registrar en https://dashboard.stripe.com/register con la **LLC USA** (Maxnova & Luci).
- Completar KYC y activar la cuenta para cobros reales.
- Configurar payout a la cuenta de Pacific National Bank.

## 2. Crear producto y precio

En el dashboard de Stripe:
1. Products → Add product → nombre "Alika Clínica".
2. Add price → Recurring / mensual / USD (o la moneda decidida) / monto.
3. Copiar el **Price ID** (empieza con `price_...`).

## 3. Configurar env vars

**En `.env` local** (para dev) y **en Vercel Env Vars** (para producción):

```
STRIPE_SECRET_KEY=sk_test_...      # o sk_live_ en producción
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...    # se obtiene en el paso 4
STRIPE_PRICE_ID_CLINIC_MONTHLY=price_...
```

⚠️ **Solo `VITE_STRIPE_PUBLISHABLE_KEY` se expone al navegador.** Las otras tres SON server-only.

## 4. Configurar webhook

En el dashboard de Stripe → Developers → Webhooks:

1. Add endpoint → URL: `https://alika.com/api/stripe/webhook`.
2. Eventos a escuchar:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
3. Copiar el **Signing secret** (`whsec_...`) a `STRIPE_WEBHOOK_SECRET`.

Para dev local: usar `stripe listen --forward-to localhost:8080/api/stripe/webhook` (Stripe CLI).

## 5. Verificar

- Onboarding de una clínica de prueba → botón "Suscribirse" (por implementar en UI) llama `createCheckoutSession` → redirige a Stripe.
- Completar el checkout con tarjeta de test `4242 4242 4242 4242`.
- Verificar en la DB: `SELECT * FROM subscriptions WHERE clinic_id = ...` — debe aparecer con `status = trialing` y `trial_end` a 14 días.
- Verificar en la DB: `SELECT * FROM stripe_events ORDER BY received_at DESC` — el evento debe estar registrado.

## Qué queda por hacer en código después del setup

Con las env vars listas, faltan tres piezas de UI/UX (una tarde de trabajo):

1. **Botón "Suscribirse"** en `/preferencias` o durante onboarding que llame `createCheckoutSession` con la URL de vuelta.
2. **Banner de trial** en `AppShell` que muestre "Trial vence en X días" usando `trialDaysLeft(sub)`.
3. **Gate por sub activa** en `_authenticated/_clinic/route.tsx`:
   - Si `!isSubscriptionActive(sub)` y la ruta no es `/preferencias/billing`, redirect ahí con banner "Reactivá tu suscripción para seguir usando Alika".
4. **Botón "Gestionar facturación"** en `/preferencias` que llame `createBillingPortalSession`.

Todo está pre-wireado en `src/lib/billing.functions.ts`. Solo faltan los components y los guards.

## Schema aplicado

Migración `20260814120000_*.sql` ya en el Supabase real:

- `subscriptions` — 1 fila por clínica, espejo del estado Stripe. RLS: miembros leen la de su clínica; solo el webhook escribe (service_role).
- `stripe_events` — ledger idempotente. Sin policy: nadie desde authenticated. Solo service_role via webhook.
- `has_active_subscription(clinic_id)` — helper SECURITY DEFINER para el gate.
