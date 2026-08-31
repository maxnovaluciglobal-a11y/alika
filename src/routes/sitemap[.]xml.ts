import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // `alika.com` todavía no está comprado (ver docs/DEPLOY_PRODUCTION.md) — hardcodearlo
        // acá generaba URLs a un dominio que no resuelve a la app. PUBLIC_APP_URL manda
        // cuando está seteada (preview/staging/prod con dominio propio ya definido); si no,
        // se deriva del host real de la request (hoy `alika-omega.vercel.app`), así el
        // sitemap siempre queda correcto sin volver a tocar este archivo cuando cambie el dominio.
        const BASE_URL =
          (typeof process !== "undefined" && process.env.PUBLIC_APP_URL) ||
          new URL(request.url).origin;

        // Solo rutas públicas indexables: /auth tiene robots:noindex (ver auth.tsx) —
        // no tiene sentido listarla acá, generaba una contradicción con el meta tag.
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/faq", changefreq: "monthly", priority: "0.6" },
          { path: "/nosotros", changefreq: "monthly", priority: "0.4" },
          { path: "/docs", changefreq: "monthly", priority: "0.5" },
          { path: "/docs/primeros-pasos", changefreq: "monthly", priority: "0.4" },
          { path: "/docs/whatsapp", changefreq: "monthly", priority: "0.4" },
          { path: "/docs/portal-pacientes", changefreq: "monthly", priority: "0.4" },
          { path: "/docs/datos-y-seguridad", changefreq: "monthly", priority: "0.4" },
          { path: "/privacidad", changefreq: "yearly", priority: "0.3" },
          { path: "/terminos", changefreq: "yearly", priority: "0.3" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
