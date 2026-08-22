import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SUBSCRIPTION_STATUSES, type Subscription } from "@/lib/billing";
import { planPriceId, getStripe, type BillingPlan } from "@/lib/stripe.server";

type SubscriptionRow = {
  clinic_id: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

function mapSubscription(row: SubscriptionRow): Subscription {
  const status = (SUBSCRIPTION_STATUSES as readonly string[]).includes(row.status)
    ? (row.status as Subscription["status"])
    : "incomplete";
  return {
    clinicId: row.clinic_id,
    status,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id,
    trialEnd: row.trial_end,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
  };
}

/** Suscripción de la clínica activa. `null` si aún no se creó ninguna. */
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<Subscription | null> => {
    const { data: row, error } = await context.supabase
      .from("subscriptions")
      .select(
        "clinic_id, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, trial_end, current_period_end, cancel_at_period_end",
      )
      .eq("clinic_id", data.clinicId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return mapSubscription(row as SubscriptionRow);
  });

/**
 * Crea (o reutiliza) una sesión de Stripe Checkout para que la clínica
 * arranque su trial + suscripción. Devuelve la URL a la que hay que
 * redirigir. Guarda customer_id en la tabla local cuando lo obtiene.
 *
 * ⚠️ Requiere que Walter haya:
 *   1) Creado el producto + price en Stripe.
 *   2) Seteado STRIPE_SECRET_KEY y STRIPE_PRICE_ID_CLINIC_MONTHLY en env.
 *   3) Configurado el webhook a /api/stripe/webhook con STRIPE_WEBHOOK_SECRET.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        plan: z.enum(["solo", "clinica"]).default("clinica"),
        // URLs a las que Stripe redirige tras completar/cancelar.
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const stripe = getStripe();
    const priceId = planPriceId(data.plan as BillingPlan);
    const { supabase, userId } = context;

    // Traer datos de la clínica + email del owner para pre-poblar Stripe.
    const { data: clinic, error: clinicErr } = await supabase
      .from("clinics")
      .select("id, name")
      .eq("id", data.clinicId)
      .maybeSingle();
    if (clinicErr) throw new Error(clinicErr.message);
    if (!clinic) throw new Error("Clínica no encontrada o no tienes permisos.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle();

    const { data: existing } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("clinic_id", data.clinicId)
      .maybeSingle();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: existing?.stripe_customer_id ?? undefined,
      customer_email: existing?.stripe_customer_id ? undefined : (profile?.email ?? undefined),
      client_reference_id: data.clinicId,
      // No exigir tarjeta de entrada durante el trial (coherente con el copy
      // de suscripcion.tsx: "no cobramos hasta que termine" el trial). Con
      // trial_period_days > 0 el total del checkout es 0, así que Stripe
      // omite la recolección de método de pago con este flag.
      payment_method_collection: "if_required",
      metadata: {
        clinic_id: data.clinicId,
        clinic_name: clinic.name ?? "",
      },
      subscription_data: {
        trial_period_days: 14,
        metadata: { clinic_id: data.clinicId },
      },
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
    });

    if (!session.url) throw new Error("Stripe no devolvió URL de checkout.");
    return { url: session.url };
  });

/**
 * Portal de facturación de Stripe para que la clínica gestione método de
 * pago, cancele, descargue facturas. Devuelve URL para redirigir.
 */
export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        returnUrl: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const stripe = getStripe();
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("clinic_id", data.clinicId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub?.stripe_customer_id) {
      throw new Error("La clínica aún no tiene una suscripción activa.");
    }
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: data.returnUrl,
    });
    return { url: portal.url };
  });
