// URL pública del sitio: ÚNICO lugar del código con el dominio de fallback.
// PUBLIC_APP_URL manda si está seteada; si no, se cae al dominio real de hoy
// (el dominio propio de Esmalia todavía no está configurado, ver
// docs/DEPLOY_PRODUCTION.md). Lo usan canonical, og:url, og:image y el JSON-LD;
// el sitemap deriva el host de la request cuando no hay PUBLIC_APP_URL.
export const SITE_URL =
  (typeof process !== "undefined" && process.env.PUBLIC_APP_URL) ||
  "https://alika-omega.vercel.app";

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

/** Organization + WebSite + SoftwareApplication — sitewide, va en __root.tsx. */
export function siteJsonLdScripts() {
  return [
    ldJsonScript({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Esmalia",
      url: SITE_URL,
      logo: `${SITE_URL}/icons/apple-touch-icon.png`,
      description: "Software de gestión para clínicas dentales de Latinoamérica.",
    }),
    ldJsonScript({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Esmalia",
      url: SITE_URL,
    }),
    ldJsonScript({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Esmalia",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description:
        "Agenda, ficha clínica, odontograma, presupuestos, cobranza y WhatsApp integrado para clínicas dentales.",
      inLanguage: "es",
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
