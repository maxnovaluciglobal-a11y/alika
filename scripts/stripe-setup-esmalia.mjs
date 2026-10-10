#!/usr/bin/env node
/**
 * Configura la cuenta de Stripe propia de Esmalia (separada de DypOS).
 *
 *   STRIPE_SECRET_KEY=... node scripts/stripe-setup-esmalia.mjs            # revisa y crea
 *   STRIPE_SECRET_KEY=... node scripts/stripe-setup-esmalia.mjs --vercel   # además carga en Vercel
 *
 * Mejor sin dejar la clave en el historial del shell: `read -s STRIPE_SECRET_KEY`
 * (pegar, Enter), `export STRIPE_SECRET_KEY` y después el comando.
 *
 * Idempotente: busca por `lookup_key` / metadata antes de crear, así que se
 * puede correr de nuevo sin duplicar nada. Crea:
 *   - productos "Esmalia Solo" y "Esmalia Clínica" con precios mensuales en
 *     USD (29 y 69), lookup keys `esmalia_solo_monthly` / `esmalia_clinic_monthly`;
 *   - la configuración del portal de facturación (cambiar tarjeta, facturas,
 *     cancelar al fin del período);
 *   - el webhook https://esmalia.com/api/stripe/webhook con los eventos que
 *     procesa `src/routes/api.stripe.webhook.ts`.
 *
 * Con --vercel reemplaza en Vercel (production) los IDs de precio y el
 * signing secret del webhook, pasándolos por stdin: el secret no se imprime.
 * `STRIPE_SECRET_KEY` y `VITE_STRIPE_PUBLISHABLE_KEY` los carga Walter a mano
 * (la publicable no se puede leer por API).
 *
 * Lo que la API no deja tocar en la cuenta propia (nombre público, logo,
 * colores, statement descriptor, email de soporte) va por el dashboard: ver
 * docs/STRIPE_SETUP.md, sección "Cuenta propia de Esmalia".
 */
import { execFileSync } from "node:child_process";

import Stripe from "stripe";

const SITE = "https://esmalia.com";
const WEBHOOK_URL = `${SITE}/api/stripe/webhook`;
const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
];
const PLANES = [
  {
    lookup: "esmalia_solo_monthly",
    nombre: "Esmalia Solo",
    descripcion: "1 profesional. Agenda, ficha clínica, recordatorios, caja y presupuestos.",
    centavos: 2900,
    envs: ["STRIPE_PRICE_ID_SOLO_MONTHLY", "VITE_STRIPE_PRICE_ID_SOLO_MONTHLY"],
  },
  {
    lookup: "esmalia_clinic_monthly",
    nombre: "Esmalia Clínica",
    descripcion:
      "Hasta 3 profesionales. Todo lo de Solo, más comisiones, roles y portal de pacientes.",
    centavos: 6900,
    envs: ["STRIPE_PRICE_ID_CLINIC_MONTHLY", "VITE_STRIPE_PRICE_ID_CLINIC_MONTHLY"],
  },
];

const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!/^(sk|rk)_(live|test)_/.test(key)) {
  console.error("Falta STRIPE_SECRET_KEY (sk_live_… o sk_test_…) de la cuenta de Esmalia.");
  process.exit(1);
}
const modo = key.includes("_live_") ? "LIVE" : "TEST";
const conVercel = process.argv.includes("--vercel");
const stripe = new Stripe(key, { apiVersion: "2026-07-29.dahlia" });

function paso(t) {
  console.log(`\n▸ ${t}`);
}

// 1. Que la clave sea de la cuenta correcta, no de la compartida con DypOS.
paso(`Cuenta (${modo})`);
const cuenta = await stripe.accounts.retrieve();
const nombre =
  cuenta.business_profile?.name ?? cuenta.settings?.dashboard?.display_name ?? "(sin nombre)";
console.log(`  ${cuenta.id} · ${nombre} · país ${cuenta.country}`);
console.log(`  cobros habilitados: ${cuenta.charges_enabled} · pagos: ${cuenta.payouts_enabled}`);
if (/dypos/i.test(nombre)) {
  console.error("  Esta clave es de la cuenta de DypOS. Usa la de la cuenta nueva de Esmalia.");
  process.exit(1);
}
if (modo === "LIVE" && !cuenta.charges_enabled) {
  console.warn("  Ojo: la cuenta todavía no puede cobrar. Completa la activación en el dashboard.");
}

// 2. Productos y precios.
paso("Productos y precios");
const precios = {};
for (const p of PLANES) {
  const existentes = await stripe.prices.list({ lookup_keys: [p.lookup], active: true, limit: 1 });
  let price = existentes.data[0];
  if (!price) {
    const producto = await stripe.products.create({
      name: p.nombre,
      description: p.descripcion,
      metadata: { app: "esmalia", lookup: p.lookup },
    });
    price = await stripe.prices.create({
      product: producto.id,
      currency: "usd",
      unit_amount: p.centavos,
      recurring: { interval: "month" },
      lookup_key: p.lookup,
      tax_behavior: "unspecified",
      metadata: { app: "esmalia" },
    });
    console.log(`  creado ${p.nombre}: ${price.id}`);
  } else {
    console.log(`  ya existía ${p.nombre}: ${price.id}`);
  }
  precios[p.lookup] = price.id;
}

// 3. Portal de facturación.
paso("Portal de facturación");
const portales = await stripe.billingPortal.configurations.list({ limit: 20 });
const yaPortal = portales.data.find((c) => c.metadata?.app === "esmalia" && c.active);
const configPortal = {
  business_profile: {
    headline: "Esmalia: administra tu suscripción",
    privacy_policy_url: `${SITE}/privacidad`,
    terms_of_service_url: `${SITE}/terminos`,
  },
  default_return_url: `${SITE}/suscripcion`,
  features: {
    customer_update: { enabled: true, allowed_updates: ["email", "address", "name", "tax_id"] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      cancellation_reason: {
        enabled: true,
        options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
      },
    },
  },
  metadata: { app: "esmalia" },
};
const portal = yaPortal
  ? await stripe.billingPortal.configurations.update(yaPortal.id, configPortal)
  : await stripe.billingPortal.configurations.create({ ...configPortal, is_default: true });
console.log(`  ${yaPortal ? "actualizado" : "creado"}: ${portal.id}`);

// 4. Webhook.
paso("Webhook");
const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
let endpoint = endpoints.data.find((e) => e.url === WEBHOOK_URL);
let secret = null;
if (endpoint) {
  await stripe.webhookEndpoints.update(endpoint.id, { enabled_events: WEBHOOK_EVENTS });
  console.log(`  ya existía ${endpoint.id} (eventos actualizados).`);
  console.log("  El signing secret solo se ve al crearlo: si hace falta, cópialo del dashboard.");
} else if (!conVercel) {
  // Stripe muestra el signing secret una sola vez, al crear el endpoint:
  // crearlo sin poder guardarlo en Vercel en el mismo paso lo dejaría perdido.
  console.log("  No existe todavía. Se crea al correr con --vercel, que guarda el secret.");
} else {
  endpoint = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: WEBHOOK_EVENTS,
    description: "Esmalia (producción)",
    metadata: { app: "esmalia" },
  });
  secret = endpoint.secret;
  console.log(`  creado ${endpoint.id} → ${WEBHOOK_URL}`);
}

// 5. Vercel.
function reemplazarEnVercel(nombreVar, valor) {
  try {
    execFileSync("vercel", ["env", "rm", nombreVar, "production", "-y"], { stdio: "ignore" });
  } catch {
    // No existía: está bien.
  }
  execFileSync("vercel", ["env", "add", nombreVar, "production"], {
    input: valor,
    stdio: ["pipe", "ignore", "inherit"],
  });
  console.log(`  ${nombreVar} ✓`);
}

paso("Resultado");
for (const p of PLANES) {
  for (const env of p.envs) console.log(`  ${env}=${precios[p.lookup]}`);
}
if (conVercel) {
  paso("Cargando en Vercel (production)");
  for (const p of PLANES) for (const env of p.envs) reemplazarEnVercel(env, precios[p.lookup]);
  if (secret) reemplazarEnVercel("STRIPE_WEBHOOK_SECRET", secret);
  else console.log("  STRIPE_WEBHOOK_SECRET sin cambios (el webhook ya existía).");
} else if (secret) {
  console.log("\n  Webhook nuevo: corre de nuevo con --vercel para cargar el signing secret");
  console.log("  sin mostrarlo, o cópialo desde el dashboard del endpoint.");
}

console.log(
  "\nFalta a mano: STRIPE_SECRET_KEY y VITE_STRIPE_PUBLISHABLE_KEY en Vercel, y un redeploy.",
);
