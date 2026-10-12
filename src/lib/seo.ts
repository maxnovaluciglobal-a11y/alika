// URL pública del sitio: ÚNICO lugar del código con el dominio de fallback.
// PUBLIC_APP_URL manda si está seteada (en producción: https://esmalia.com,
// desde el 09-oct-2026); el fallback es el mismo dominio propio. Lo usan canonical, og:url, og:image y el JSON-LD;
// el sitemap deriva el host de la request cuando no hay PUBLIC_APP_URL.
export const SITE_URL =
  (typeof process !== "undefined" && process.env.PUBLIC_APP_URL) || "https://esmalia.com";

/** Link `rel=canonical` + `og:url` para una ruta pública. `path` incluye la barra inicial. */
export function canonicalHead(path: string) {
  const url = `${SITE_URL}${path}`;
  return {
    links: [{ rel: "canonical", href: url }],
    meta: [{ property: "og:url", content: url }],
  };
}

// OJO: el shape que espera `head().scripts` NO anida bajo `attrs` — TanStack
// Router mapea `match.headScripts` tomando cada item entero (menos `children`)
// como los atributos HTML directamente (ver headContentUtils.js). Anidar acá
// produce un <script attrs="[object Object]"> roto en vez de type="...".
function ldJsonScript(data: Record<string, unknown>) {
  return { type: "application/ld+json", children: JSON.stringify(data) };
}

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

// Perfiles públicos de la marca para `sameAs`. Vacío a propósito hasta que
// existan: un sameAs a una URL inexistente confunde más de lo que ayuda.
export const SAME_AS: string[] = [];

// Lo mismo que dice public/llms.txt: el schema y el llms.txt no pueden
// contradecirse (los motores de IA los contrastan).
const FEATURE_LIST = [
  "Agenda por sucursal en hora local",
  "Recordatorios por WhatsApp 48 h y 3 h antes, enviados por la clínica con un toque",
  "Ficha clínica y odontograma FDI versionado",
  "Presupuestos y planes de tratamiento",
  "Caja, saldos y comisiones de profesionales",
  "Funciona sin internet y sincroniza al volver la conexión",
  "Patty, asistente de IA para notas y resúmenes, sin decisiones clínicas",
];

/** Precio mensual explícito (unitCode MON = mes, UN/CEFACT). */
function ofertaMensual(name: string, price: string, description: string) {
  return {
    "@type": "Offer",
    name,
    price,
    priceCurrency: "USD",
    description,
    url: `${SITE_URL}/precios`,
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price,
      priceCurrency: "USD",
      unitCode: "MON",
      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
    },
  };
}

export const PLAN_OFFERS = [
  ofertaMensual("Solo", "29", "1 profesional, pago mensual. 14 días gratis."),
  ofertaMensual("Clínica", "69", "Hasta 3 profesionales, pago mensual. 14 días gratis."),
];

/** Organization + WebSite + SoftwareApplication — sitewide, va en __root.tsx. */
export function siteJsonLdScripts() {
  return [
    ldJsonScript({
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: "Esmalia",
      legalName: "MAXNOVA & LUCI Global LLC",
      url: SITE_URL,
      logo: `${SITE_URL}/icons/apple-touch-icon.png`,
      description: "Software de gestión para clínicas dentales de Latinoamérica.",
      email: "hola@esmalia.com",
      founder: { "@type": "Person", name: "Walter La Madriz" },
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: "soporte@esmalia.com",
          availableLanguage: ["es"],
        },
        {
          "@type": "ContactPoint",
          contactType: "sales",
          email: "ventas@esmalia.com",
          availableLanguage: ["es"],
        },
      ],
      // sameAs: solo perfiles que existan de verdad (ver SAME_AS).
      ...(SAME_AS.length ? { sameAs: SAME_AS } : {}),
    }),
    ldJsonScript({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Esmalia",
      url: SITE_URL,
      publisher: { "@id": ORGANIZATION_ID },
    }),
    ldJsonScript({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Esmalia",
      publisher: { "@id": ORGANIZATION_ID },
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description:
        "Agenda, ficha clínica, odontograma, presupuestos, cobranza y WhatsApp integrado para clínicas dentales.",
      inLanguage: "es",
      featureList: FEATURE_LIST,
      // Mismos 5 países que /software-dental-latam y el alta guiada.
      areaServed: [
        ["CL", "Chile"],
        ["PE", "Perú"],
        ["MX", "México"],
        ["CO", "Colombia"],
        ["AR", "Argentina"],
      ].map(([identifier, name]) => ({ "@type": "Country", identifier, name })),
      // Solo (US$29) y Clínica (US$69), ver src/lib/stripe.server.ts. Sin
      // aggregateRating hasta tener reseñas reales.
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: "29",
        highPrice: "69",
        offerCount: 2,
        description: "Plan Solo desde US$29/mes y plan Clínica US$69/mes, 14 días gratis.",
        offers: PLAN_OFFERS,
      },
    }),
  ];
}

/** FAQPage JSON-LD a partir de los mismos grupos que renderiza /faq. */
export function faqJsonLdScript(items: { q: string; a: string }[]) {
  return [
    ldJsonScript({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    }),
  ];
}
