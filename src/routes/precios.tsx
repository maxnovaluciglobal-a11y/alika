// src/routes/precios.tsx
//
// Página propia de precios (antes era un 301 a /#precios). Reusa el mismo
// bloque de planes que la landing (`PreciosPlanes`) y suma una FAQ corta.
//
// Cada respuesta de la FAQ está respaldada por el código, no por el deseo:
// - Trial de 14 días sin tarjeta: `trial_period_days: 14` +
//   `payment_method_collection: "if_required"` (billing.functions.ts) y el
//   trial que nace con la clínica (migración 20260907240000).
// - Qué sigue abierto sin suscripción: `ABIERTO_SIEMPRE` /
//   `SE_ACTIVA_AL_SUSCRIBIRTE` en components/trial-desbloqueo.tsx.
// - Cobro en USD vía Stripe, moneda local solo de referencia:
//   lib/pricing-display.ts y lib/stripe.server.ts.
// - Cancelar: portal de facturación de Stripe desde /suscripcion
//   (`createBillingPortalSession`); la cancelación corre al fin del período
//   (`cancel_at_period_end`, "Cancelada — vence el …" en suscripcion.tsx).
import { createFileRoute, Link } from "@tanstack/react-router";

import { PreciosPlanes } from "@/components/marketing/precios";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { buttonVariants } from "@/components/ui/button";
import { registrarEvento } from "@/lib/marketing/eventos";
import { canonicalHead, faqJsonLdScript, SITE_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";

const TITULO = "Precios · Alika — software dental desde US$29";
const DESCRIPCION =
  "Planes de Alika para clínicas dentales: Solo US$29/mes (1 profesional), Clínica US$69/mes (hasta 3) y Red a medida. 14 días gratis, sin tarjeta. Cobro en USD.";

const preguntas: { q: string; a: string }[] = [
  {
    q: "¿Necesito tarjeta para probar Alika?",
    a: "No. Tienes 14 días gratis desde que creas tu clínica, sin dejar tarjeta. Si al terminar no te suscribes, agenda, pacientes y ficha clínica siguen abiertos; finanzas, comisiones, inventario y los demás informes se activan al suscribirte.",
  },
  {
    q: "¿Qué incluye cada plan?",
    a: "Solo (US$29/mes, 1 profesional): agenda, ficha clínica, recordatorios por WhatsApp, caja, presupuestos e importación de pacientes por planilla. Clínica (US$69/mes, hasta 3 profesionales): todo lo de Solo, más comisiones, roles y portal de pacientes. Red (varias sedes): a medida, con multisede, inventario, reportes por sede y migración acompañada.",
  },
  {
    q: "¿En qué moneda me cobran?",
    a: "En dólares (USD), a través de Stripe. El precio en tu moneda que ves en esta página es una referencia aproximada: el monto final lo define el tipo de cambio de tu banco o tarjeta.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí. Desde Suscripción entras al portal de pagos de Stripe, donde cancelas, cambias el método de pago o descargas tus facturas. Si cancelas durante el trial no te cobramos; si ya pagaste, la suscripción sigue activa hasta el fin del período.",
  },
  {
    q: "¿Qué es el precio fundador?",
    a: "Quienes entran en esta etapa conservan el precio de su plan mientras sean clientes.",
  },
];

function productoJsonLd() {
  const url = `${SITE_URL}/precios`;
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Alika",
      description:
        "Software de gestión para clínicas dentales: agenda, ficha clínica, odontograma, presupuestos, caja y recordatorios por WhatsApp.",
      brand: { "@type": "Brand", name: "Alika" },
      url,
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: "29",
        highPrice: "69",
        offerCount: 2,
        url,
        offers: [
          {
            "@type": "Offer",
            name: "Solo",
            price: "29",
            priceCurrency: "USD",
            description: "1 profesional, pago mensual. 14 días gratis.",
          },
          {
            "@type": "Offer",
            name: "Clínica",
            price: "69",
            priceCurrency: "USD",
            description: "Hasta 3 profesionales, pago mensual. 14 días gratis.",
          },
        ],
      },
    }),
  };
}

export const Route = createFileRoute("/precios")({
  head: () => {
    const canonical = canonicalHead("/precios");
    return {
      meta: [
        { title: TITULO },
        { name: "description", content: DESCRIPCION },
        { property: "og:title", content: TITULO },
        { property: "og:description", content: DESCRIPCION },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...canonical.meta,
      ],
      links: canonical.links,
      scripts: [productoJsonLd(), ...faqJsonLdScript(preguntas)],
    };
  },
  component: PaginaPrecios,
});

function PaginaPrecios() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main id="main-content">
        <section className="mx-auto max-w-6xl px-6 pt-14 pb-16 sm:pt-20">
          <p className="kicker mb-4">Precios</p>
          <PreciosPlanes encabezado="h1" lugar="pagina-precios" />
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="max-w-3xl">
            <h2 className="font-display text-3xl font-normal leading-tight sm:text-4xl">
              Preguntas sobre el precio
            </h2>
            <Accordion type="single" collapsible className="mt-6">
              {preguntas.map((p, i) => (
                <AccordionItem key={p.q} value={`p-${i}`}>
                  <AccordionTrigger className="text-left text-base">{p.q}</AccordionTrigger>
                  <AccordionContent className="leading-relaxed text-muted-foreground">
                    {p.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <p className="mt-8 text-sm text-muted-foreground">
              ¿Otra duda?{" "}
              <Link to="/faq" className="text-brand-700 underline-offset-4 hover:underline">
                Revisa las preguntas frecuentes
              </Link>{" "}
              o entra a la demo y mira la clínica por dentro.
            </p>
            <a
              href="/demo"
              onClick={() => registrarEvento("cta_click", { cta: "demo", lugar: "pagina-precios" })}
              className={cn(buttonVariants({ size: "lg" }), "mt-6")}
            >
              Entrar a la demo
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
