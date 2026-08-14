import Stripe from "stripe";

/**
 * Cliente Stripe server-only. Se instancia lazy — sin STRIPE_SECRET_KEY
 * el helper `getStripe()` tira un error claro. En dev local se puede
 * dejar sin key y todo el flujo de billing queda inactivo (sin crashear).
 *
 * Este archivo NO debe importarse desde componentes React del cliente
 * ni desde archivos que se bundlean para el navegador. El sufijo
 * `.server.ts` sirve de guardarraíl visual + Vite lo excluye del client.
 */

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY no está configurada. Setear en Vercel Env Vars y en .env local.",
    );
  }
  cached = new Stripe(key, {
    // Fijar apiVersion evita sorpresas cuando Stripe rota su default. Actualizar
    // manualmente después de leer el changelog.
    apiVersion: "2025-08-27.basil",
  });
  return cached;
}

export function stripeWebhookSecret(): string {
  const s = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s) throw new Error("STRIPE_WEBHOOK_SECRET no configurada.");
  return s;
}

/** Price ID del plan mensual de la clínica. Se crea en el dashboard de Stripe. */
export function clinicMonthlyPriceId(): string {
  const p = process.env.STRIPE_PRICE_ID_CLINIC_MONTHLY;
  if (!p) throw new Error("STRIPE_PRICE_ID_CLINIC_MONTHLY no configurada.");
  return p;
}
