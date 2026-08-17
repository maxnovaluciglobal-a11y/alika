# Setup de Stripe — Alika

Pasos que necesita hacer Walter para activar el billing skeleton ya wireado en el código (`13c2d27` → Wave B). Una vez completado, la app cobra a las clínicas automáticamente.

## Pricing decidido (ago-2026)

- **Modelo**: flat por clínica al mes (sin per-seat).
- **Precio**: **US$49 / clínica / mes**.
- **Trial**: 14 días (hardcoded en `billing.functions.ts:116`).
- **Moneda**: **USD** para todas las clínicas (no monedas locales por ahora).
- **Ciclo anual**: no implementado en v1.

## 1. Cuenta Stripe

**Ya existe** — es la misma cuenta de Maxnova & Luci LLC que ya procesa otros productos (GastroCore360). Alika es un producto nuevo dentro de esa cuenta, no una cuenta separada. No hay que registrar nada nuevo ni repetir KYC.

## 2. Crear producto y precio (dentro de la cuenta existente)

En el dashboard de Stripe, **empezar en modo Test** (toggle arriba a la derecha) para probar el flujo completo antes de tocar Live:

1. Products → Add product → nombre "Alika Clínica" (description opcional: "Gestión de clínica dental — plan mensual"). Es un producto nuevo, no reutilizar ni editar los de GastroCore.
2. Add price → **Recurring / Monthly / USD / $49.00**.
3. Copiar el **Price ID** (empieza con `price_...`) — va a `STRIPE_PRICE_ID_CLINIC_MONTHLY`.
4. Opcional pero recomendado: en el producto, setear un **statement descriptor suffix** (ej. "ALIKA") para que el cargo en el resumen de tarjeta de la clínica diga algo distinguible de GastroCore, ya que comparten la misma cuenta/entidad.
5. Repetir los pasos 1-4 en **modo Live** recién cuando el flujo de test ya esté verificado end-to-end (paso 5 de este doc) y quieras empezar a cobrar de verdad.

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

⚠️ **Cuenta compartida con GastroCore360**: este webhook tiene que ser un endpoint **nuevo y separado** del que ya existe para GastroCore — cada uno con su propio signing secret. No reutilizar el `STRIPE_WEBHOOK_SECRET` de otro proyecto acá.

En el dashboard de Stripe → Developers → Webhooks (en el mismo modo, Test o Live, en el que creaste el producto):

1. Add endpoint → URL: la del deploy de Vercel de Alika (ej. `https://aurora-dental-os.vercel.app/api/stripe/webhook`) — no hace falta esperar al dominio `alika.com`, se puede migrar el endpoint el día que exista.
2. Eventos a escuchar:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
3. Copiar el **Signing secret** (`whsec_...`) a `STRIPE_WEBHOOK_SECRET`.

Para dev local: usar `stripe listen --forward-to localhost:8080/api/stripe/webhook` (Stripe CLI) — esto genera su propio `whsec_...` de test, distinto al del endpoint de producción.

## 5. Verificar

- En `/suscripcion` (ya existe): botón "Activar suscripción · US$49/mes" llama `createCheckoutSession` → redirige a Stripe.
- Completar el checkout con tarjeta de test `4242 4242 4242 4242`.
- Verificar en la DB: `SELECT * FROM subscriptions WHERE clinic_id = ...` — debe aparecer con `status = trialing` y `trial_end` a 14 días.
- Verificar en la DB: `SELECT * FROM stripe_events ORDER BY received_at DESC` — el evento debe estar registrado.
- Botón "Gestionar facturación" en la misma página → debe abrir el portal de Stripe.

## Estado del código

Ya no falta nada de código — esto quedó completo en Wave B y sesiones posteriores: `/suscripcion` (UI completa: estado, días de trial, activar/reactivar, portal de facturación), el gate de suscripción en `_authenticated/_clinic/route.tsx`, y el webhook con los 5 eventos. Lo único pendiente es esta configuración de cuenta.

## Schema aplicado

Migración `20260814120000_*.sql` ya en el Supabase real:

- `subscriptions` — 1 fila por clínica, espejo del estado Stripe. RLS: miembros leen la de su clínica; solo el webhook escribe (service_role).
- `stripe_events` — ledger idempotente. Sin policy: nadie desde authenticated. Solo service_role via webhook.
- `has_active_subscription(clinic_id)` — helper SECURITY DEFINER para el gate.
