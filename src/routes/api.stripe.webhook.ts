import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

import { getStripe, stripeWebhookSecret } from "@/lib/stripe.server";
import type { Json } from "@/integrations/supabase/types";

/**
 * Webhook de Stripe. Configurar en el dashboard de Stripe apuntando a
 * `https://alika.com/api/stripe/webhook` y elegir los eventos:
 *   - checkout.session.completed
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_failed
 *
 * Idempotencia: guardamos `event.id` en `stripe_events` primero. Si ya
 * existe (retry de Stripe) devolvemos 200 sin re-procesar.
 */

async function upsertSubscription(
  admin: Awaited<ReturnType<typeof import("@/integrations/supabase/client.server").supabaseAdmin.from>>["from"] extends never
    ? never
    : import("@supabase/supabase-js").SupabaseClient,
  clinicId: string,
  sub: Stripe.Subscription,
) {
  const priceId = sub.items.data[0]?.price?.id ?? null;
  const currentPeriodEndTs = (sub as unknown as { current_period_end?: number }).current_period_end;
  await admin
    .from("subscriptions")
    .upsert(
      {
        clinic_id: clinicId,
        stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        stripe_subscription_id: sub.id,
        stripe_price_id: priceId,
        status: sub.status,
        trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        current_period_end: currentPeriodEndTs
          ? new Date(currentPeriodEndTs * 1000).toISOString()
          : null,
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
