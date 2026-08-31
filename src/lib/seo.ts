// Mismo criterio que src/routes/sitemap[.]xml.ts y __root.tsx: PUBLIC_APP_URL
// manda si está seteada; si no, se cae al dominio real de hoy (alika.com
// todavía no está comprado, ver docs/DEPLOY_PRODUCTION.md). Centralizado acá
// para que canonical, og:url y el sitemap no diverjan.
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
      name: "Alika",
      url: SITE_URL,
      logo: `${SITE_URL}/icons/apple-touch-icon.png`,
      description: "Software de gestión para clínicas dentales de Latinoamérica.",
    }),
    ldJsonScript({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Alika",
      url: SITE_URL,
    }),
    ldJsonScript({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Alika",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description:
        "Agenda, ficha clínica, odontograma, presupuestos, cobranza y WhatsApp integrado para clínicas dentales.",
      offers: {
        "@type": "Offer",
        priceCurrency: "USD",
        price: "29",
        description: "Plan Solo, 1 profesional, desde US$29/mes.",
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
