# Setup de Stripe — Alika

## ⚠️ Corrección 2026-09-01 (auditoría externa) — la línea de abajo estaba mal

Esta línea decía "Live conectado y verificado" y "las 4 env vars están en Vercel
producción" — verificado en vivo, **ninguna de las dos cosas era cierta hasta
hoy**: `STRIPE_SECRET_KEY` de Vercel producción sigue siendo de **test**
(`sk_test_...`), y solo 1 de las 4 env vars de price ID estaba cargada
(`STRIPE_PRICE_ID_CLINIC_MONTHLY`) — faltaban las otras 3, así que el checkout
del plan Solo tiraba error de servidor. Además **no existía ningún webhook
endpoint de Alika en el dashboard de Stripe** (el único configurado en toda la
cuenta era el de GastroCore360) — el `STRIPE_WEBHOOK_SECRET` que había en
Vercel no correspondía a nada real.

**Arreglado hoy (todo en modo TEST, nada en Live todavía):** las 3 env vars de
price ID que faltaban se cargaron con los price IDs reales que ya existían en
Stripe test (`price_1U7EiDRxn4y6AU3rmyBTh8AZ` Solo, `price_1U7EiDRxn4y6AU3reNFlzGSo`
Clínica); se creó el webhook endpoint real (`we_1UAprHRxn4y6AU3r4BNjvOY9`) apuntando
a `https://alika-omega.vercel.app/api/stripe/webhook` con los 5 eventos que el
código maneja, y `STRIPE_WEBHOOK_SECRET` en Vercel se reemplazó por el signing
secret real de ese endpoint nuevo.

**Sigue pendiente, de verdad esta vez:** repetir producto+precios+webhook en
modo **Live** cuando se quiera cobrar de verdad (pasos 2 y 4 de abajo, en el
toggle Live del dashboard) — hoy todo lo que funciona es test-mode, cero
capacidad de cobro real todavía.

---

Test configurado y verificado en vivo (01-sep-2026, ver corrección arriba). Live NO está configurado todavía. Este doc queda como referencia de cómo se hizo y para cuando se quiera pasar a Live.

## Pricing decidido (actualizado 2026-08-22)

- **Modelo**: dos tiers de fundador, no un flat único (reemplaza el US$49 flat original).
  - **Solo** — US$29/mes (regular US$49, tachado en la UI como promocional) — 1 profesional/sillón.
  - **Clínica** — US$69/mes (regular US$99, tachado) — hasta 3 profesionales/sillones.
  - Arriba de 3 sillones: sin SKU todavía (`pricing-4` de la auditoría, add-on por profesional extra queda diferido).
- **Precio viejo US$49 flat**: archivado en Stripe (`active=false`, ya no se ofrece en checkouts nuevos), pero cualquier suscripción existente con ese price sigue funcionando sin cambios — Stripe no migra suscripciones activas al archivar un price.
- **Trial**: 14 días (`billing.functions.ts`, `subscription_data.trial_period_days`).
- **Moneda**: **USD** para el cobro real. La UI muestra una conversión aproximada a CLP/MXN/COP solo informativa (`src/lib/pricing-display.ts`), nunca cambia el monto cobrado.
- **Ciclo anual**: no implementado — diferido hasta la primera renovación real (`pricing-5` de la auditoría).

## 1. Cuenta Stripe

**Ya existe** — es la misma cuenta de Maxnova & Luci LLC que ya procesa otros productos (GastroCore360). Alika es un producto nuevo dentro de esa cuenta, no una cuenta separada. No hay que registrar nada nuevo ni repetir KYC.

## 2. Crear producto y precio (dentro de la cuenta existente)

En el dashboard de Stripe, **empezar en modo Test** (toggle arriba a la derecha) para probar el flujo completo antes de tocar Live:

1. Products → el producto "Alika Clínica" ya existe (`prod_V5QKNBePgv0Gdm` en test) — no crear uno nuevo, se reusa para los dos precios.
2. Add price → **Recurring / Monthly / USD / $29.00** (nickname "Alika Solo (fundador)", metadata `plan=solo`). Repetir con **$69.00** (nickname "Alika Clínica (fundador)", metadata `plan=clinica`).
3. Copiar cada **Price ID** — van a `STRIPE_PRICE_ID_SOLO_MONTHLY` y `STRIPE_PRICE_ID_CLINIC_MONTHLY` respectivamente (y sus gemelas `VITE_` para que el cliente muestre el plan activo).
4. El price viejo de $49 (default price anterior del producto) ya está archivado (`active=false`) en test — si existe un equivalente en Live, archivarlo ahí también recién cuando los dos nuevos estén verificados.
5. Opcional pero recomendado: en el producto, setear un **statement descriptor suffix** (ej. "ALIKA") para que el cargo en el resumen de tarjeta de la clínica diga algo distinguible de GastroCore, ya que comparten la misma cuenta/entidad.
6. Repetir los pasos 1-3 en **modo Live** cuando el flujo de test ya esté verificado end-to-end y quieras empezar a cobrar de verdad con los tiers nuevos.

## 3. Configurar env vars

**En `.env` local** (para dev) y **en Vercel Env Vars** (para producción):

```
STRIPE_SECRET_KEY=sk_test_...      # o sk_live_ en producción
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...    # se obtiene en el paso 4
STRIPE_PRICE_ID_SOLO_MONTHLY=price_...
STRIPE_PRICE_ID_CLINIC_MONTHLY=price_...
VITE_STRIPE_PRICE_ID_SOLO_MONTHLY=price_...      # mismo valor que arriba
VITE_STRIPE_PRICE_ID_CLINIC_MONTHLY=price_...    # mismo valor que arriba
```

⚠️ **Solo las variables `VITE_*` se exponen al navegador** (las `VITE_STRIPE_PRICE_ID_*` son intencional — son IDs de price, no secretos, y el cliente las necesita para mostrar qué plan está activo sin pedirle nada al server). `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, y las versiones sin `VITE_` de los price IDs son server-only.

## 4. Configurar webhook

⚠️ **Cuenta compartida con GastroCore360**: este webhook tiene que ser un endpoint **nuevo y separado** del que ya existe para GastroCore — cada uno con su propio signing secret. No reutilizar el `STRIPE_WEBHOOK_SECRET` de otro proyecto acá.

En el dashboard de Stripe → Developers → Webhooks (en el mismo modo, Test o Live, en el que creaste el producto):

1. Add endpoint → URL: `https://alika-omega.vercel.app/api/stripe/webhook` (proyecto Vercel real, `prj_2qH7NKthOoML1ZsCKLbKDV8rzan2`) — no hace falta esperar al dominio `alika.com`, se puede migrar el endpoint el día que exista.
2. Eventos a escuchar:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
3. Copiar el **Signing secret** (`whsec_...`) a `STRIPE_WEBHOOK_SECRET`.

Para dev local: usar `stripe listen --forward-to localhost:8080/api/stripe/webhook` (Stripe CLI) — esto genera su propio `whsec_...` de test, distinto al del endpoint de producción.

## 5. Verificar

- En `/suscripcion` (ya existe): elegí un plan (Solo/Clínica) y el botón "Activar suscripción · US$29/mes" (o el que corresponda) llama `createCheckoutSession` con ese `plan` → redirige a Stripe.
- Completar el checkout con tarjeta de test `4242 4242 4242 4242`.
- Verificar en la DB: `SELECT * FROM subscriptions WHERE clinic_id = ...` — debe aparecer con `status = trialing` y `trial_end` a 14 días.
- Verificar en la DB: `SELECT * FROM stripe_events ORDER BY received_at DESC` — el evento debe estar registrado.
- Botón "Gestionar facturación" en la misma página → debe abrir el portal de Stripe.

## Rotación de keys (cuenta compartida con GastroCore)

`STRIPE_SECRET_KEY` en Live es una **restricted key** (`rk_live_...`), no la key por defecto de la cuenta — se creó así a propósito para no tocar la key que ya usa GastroCore para cobrar. Permisos: Checkout Sessions (Write), Subscriptions (Write), Customers (Write), Billing Portal (Write), Invoices (Read). Si hay que rotarla, crear una restricted key nueva con los mismos permisos — nunca usar "Roll key" sobre la key default de la cuenta.

## Dónde vive cada cosa

- **`.env` local**: valores de **Test mode** — para desarrollar sin tocar Live.
- **Vercel env vars (producción)**: valores de **Live mode** — cargadas 2026-08-16, confirmadas con `vercel env ls`.

## Estado del código

Ya no falta nada de código — esto quedó completo en Wave B y sesiones posteriores: `/suscripcion` (UI completa: estado, días de trial, activar/reactivar, portal de facturación), el gate de suscripción en `_authenticated/_clinic/route.tsx`, y el webhook con los 5 eventos. Lo único pendiente es esta configuración de cuenta.

## Schema aplicado

Migración `20260814120000_*.sql` ya en el Supabase real:

- `subscriptions` — 1 fila por clínica, espejo del estado Stripe. RLS: miembros leen la de su clínica; solo el webhook escribe (service_role).
- `stripe_events` — ledger idempotente. Sin policy: nadie desde authenticated. Solo service_role via webhook.
- `has_active_subscription(clinic_id)` — helper SECURITY DEFINER para el gate.
