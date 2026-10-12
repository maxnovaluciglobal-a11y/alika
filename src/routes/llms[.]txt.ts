import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import base from "@/content/llms-base.md?raw";
import { NOMBRE_COLECCION, paginasPublicadas } from "@/content";
import type { Coleccion } from "@/content/tipos";
import { SITE_URL } from "@/lib/seo";

// /llms.txt = el texto fijo de src/content/llms-base.md + un índice de las
// páginas editoriales publicadas (src/content/paginas/), así cada página nueva
// aparece acá sin tocar nada. Lo que dice este archivo y lo que dicen las
// páginas tiene que coincidir: los motores de IA los contrastan.
const ORDEN: Coleccion[] = [
  "funciones",
  "pais",
  "para",
  "comparar",
  "alternativas",
  "guias",
  "plantillas",
];

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        const paginas = await paginasPublicadas();
        const secciones = ORDEN.map((c) => {
          const de = paginas.filter((p) => p.coleccion === c);
          if (!de.length) return "";
          const lineas = de.map((p) => `- [${p.h1}](${SITE_URL}${p.path}): ${p.enUnaLinea}`);
          return `## ${NOMBRE_COLECCION[c]}\n\n${lineas.join("\n")}\n`;
        }).filter(Boolean);
        const texto = [base.trimEnd(), ...secciones].join("\n\n") + "\n";
        return new Response(texto, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
