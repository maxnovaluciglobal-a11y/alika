import { createFileRoute } from "@tanstack/react-router";

import { IndiceContenido } from "@/components/marketing/pagina-contenido";
import { aEnlace, paginasPublicadas } from "@/content";
import { canonicalHead } from "@/lib/seo";

const TITULO = "Comparativas de software dental | Esmalia";
const DESCRIPCION =
  "Esmalia frente a Dentalink, AgendaPro, Doctocliq y otros: precios publicados, funciones y en qué gana cada uno, con fuentes y fecha.";

export const Route = createFileRoute("/comparar/")({
  loader: async () => ({
    comparar: (await paginasPublicadas("comparar")).map(aEnlace),
    alternativas: (await paginasPublicadas("alternativas")).map(aEnlace),
  }),
  head: () => {
    const canonical = canonicalHead("/comparar");
    return {
      meta: [
        { title: TITULO },
        { name: "description", content: DESCRIPCION },
        { property: "og:title", content: TITULO },
        { property: "og:description", content: DESCRIPCION },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  component: Comparar,
});

function Comparar() {
  const { comparar, alternativas } = Route.useLoaderData();
  return (
    <IndiceContenido
      kicker="Comparativas"
      titulo="Comparativas de software dental, con fuentes y fecha"
      intro="Esmalia es nuestro producto, así que lo decimos de entrada. Cada comparativa cita la web oficial de cada competidor y dice en qué gana el otro."
      grupos={[
        { titulo: "Comparativas", paginas: comparar },
        { titulo: "Alternativas", paginas: alternativas },
      ]}
    />
  );
}
