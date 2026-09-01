import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

import { getStripe, stripeWebhookSecret } from "@/lib/stripe.server";
import type { Json } from "@/integrations/supabase/types";

/**
 * Webhook de Stripe. Endpoint real creado en Stripe (test mode) el 01-sep-2026
 * apuntando a `https://alika-omega.vercel.app/api/stripe/webhook` (`alika.com`
 * es de un tercero, ver [[alika_naming_finalistas]] — no usar ese dominio acá
 * hasta que exista uno propio de verdad). Eventos habilitados:
 *   - checkout.session.completed
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_failed
 *   - charge.refunded
 *   - charge.dispute.created
 *
 * Idempotencia: guardamos `event.id` en `stripe_events` primero. Si ya
 * existe (retry de Stripe) devolvemos 200 sin re-procesar.
 */

// Auditoría de código 01-sep-2026: con apiVersion "2026-07-29.dahlia" (ver
// stripe.server.ts) Stripe ya no manda `current_period_end` en el objeto
// Subscription top-level — se movió a cada subscription item (confirmado
// contra los .d.ts del SDK instalado: SubscriptionItems sí lo tiene,
// Subscriptions ya no). El `as unknown` de acá tapaba el error de tipos en
// vez de arreglar el acceso, así que en producción esto quedaba siempre
// `undefined` y `current_period_end` se guardaba NULL para TODA suscripción
// real — rompe la fecha de renovación/vencimiento en /suscripcion y el
// self-healing check de billing.ts (isSubscriptionActive), no solo un tipo.
// Mismo patrón que `priceId` en la línea de abajo: un solo item por sub
// (modelo v1, sin per-seat/add-ons — ver comentario de la tabla).
export function extractCurrentPeriodEndIso(sub: Stripe.Subscription): string | null {
  const ts = sub.items.data[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

async function upsertSubscription(
  admin: Awaited<
    ReturnType<typeof import("@/integrations/supabase/client.server").supabaseAdmin.from>
  >["from"] extends never
    ? never
    : import("@supabase/supabase-js").SupabaseClient,
  clinicId: string,
  sub: Stripe.Subscription,
) {
  const priceId = sub.items.data[0]?.price?.id ?? null;
  await admin.from("subscriptions").upsert(
    {
      clinic_id: clinicId,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      status: sub.status,
      trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      current_period_end: extractCurrentPeriodEndIso(sub),
      cancel_at_period_end: sub.cancel_at_period_end,
    },
    { onConflict: "clinic_id" },
  );
}

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("missing signature", { status: 400 });

        const rawBody = await request.text();
        const stripe = getStripe();

        let event: Stripe.Event;
        try {
          event = stripe.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret());
        } catch (err) {
          const msg = err instanceof Error ? err.message : "invalid signature";
          return new Response(`webhook error: ${msg}`, { status: 400 });
        }

        // Cargamos el admin client dinámicamente para mantener este archivo
        // seguro de importar desde el cliente.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotencia
        const { data: exists } = await supabaseAdmin
          .from("stripe_events")
          .select("id")
          .eq("id", event.id)
          .maybeSingle();
        if (exists) return new Response("ok (dup)", { status: 200 });

        let clinicId: string | null = null;

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object as Stripe.Checkout.Session;
              clinicId =
                (session.metadata?.clinic_id as string | undefined) ??
                session.client_reference_id ??
                null;
              if (clinicId && session.subscription) {
                const subId =
                  typeof session.subscription === "string"
                    ? session.subscription
                    : session.subscription.id;
                const sub = await stripe.subscriptions.retrieve(subId);
                await upsertSubscription(supabaseAdmin, clinicId, sub);
              }
              break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
              const sub = event.data.object as Stripe.Subscription;
              clinicId = (sub.metadata?.clinic_id as string | undefined) ?? null;
              if (!clinicId && typeof sub.customer === "string") {
                // Fallback: buscar por customer_id
                const { data: row } = await supabaseAdmin
                  .from("subscriptions")
                  .select("clinic_id")
                  .eq("stripe_customer_id", sub.customer)
                  .maybeSingle();
                clinicId = row?.clinic_id ?? null;
              }
              if (clinicId) await upsertSubscription(supabaseAdmin, clinicId, sub);
              break;
            }
            case "invoice.payment_failed": {
              const invoice = event.data.object as Stripe.Invoice;
              const customerId =
                typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
              if (customerId) {
                const { data: row } = await supabaseAdmin
                  .from("subscriptions")
                  .select("clinic_id")
                  .eq("stripe_customer_id", customerId)
                  .maybeSingle();
                clinicId = row?.clinic_id ?? null;
                if (clinicId) {
                  await supabaseAdmin
                    .from("subscriptions")
                    .update({ status: "past_due" })
                    .eq("clinic_id", clinicId);
                }
              }
              break;
            }
            case "charge.refunded": {
              const charge = event.data.object as Stripe.Charge;
              // `refunded` es true solo cuando el charge quedó reembolsado
              // por completo — un reembolso parcial no debe tumbar el acceso.
              if (charge.refunded) {
                const customerId =
                  typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
                if (customerId) {
                  const { data: row } = await supabaseAdmin
                    .from("subscriptions")
                    .select("clinic_id")
                    .eq("stripe_customer_id", customerId)
                    .maybeSingle();
                  clinicId = row?.clinic_id ?? null;
                  if (clinicId) {
                    await supabaseAdmin
                      .from("subscriptions")
                      .update({ status: "canceled" })
                      .eq("clinic_id", clinicId);
                  }
                }
              }
              break;
            }
            case "charge.dispute.created": {
              const dispute = event.data.object as Stripe.Dispute;
              const chargeId =
                typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
              const disputedCharge = await stripe.charges.retrieve(chargeId);
              const customerId =
                typeof disputedCharge.customer === "string"
                  ? disputedCharge.customer
                  : disputedCharge.customer?.id;
              if (customerId) {
                const { data: row } = await supabaseAdmin
                  .from("subscriptions")
                  .select("clinic_id")
                  .eq("stripe_customer_id", customerId)
                  .maybeSingle();
                clinicId = row?.clinic_id ?? null;
                if (clinicId) {
                  await supabaseAdmin
                    .from("subscriptions")
                    .update({ status: "canceled" })
                    .eq("clinic_id", clinicId);
                }
              }
              break;
            }
            default:
              // Registramos y salimos — no procesamos eventos que no configuramos.
              break;
          }

          // Marcar procesado
          await supabaseAdmin.from("stripe_events").insert({
            id: event.id,
            type: event.type,
            clinic_id: clinicId,
            raw: event as unknown as Json,
          });

          return new Response("ok", { status: 200 });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[stripe webhook] failure", event.type, msg);
          // Sin insertar en stripe_events → Stripe reintenta.
          return new Response(`processing error: ${msg}`, { status: 500 });
        }
      },
    },
  },
});
