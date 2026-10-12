import { createFileRoute } from "@tanstack/react-router";

import { IndiceContenido } from "@/components/marketing/pagina-contenido";
import { aEnlace, paginasPublicadas } from "@/content";
import { canonicalHead } from "@/lib/seo";

const TITULO = "Funciones del software dental Esmalia | Esmalia";
const DESCRIPCION =
  "Qué hace Esmalia en detalle: recordatorios por WhatsApp, odontograma, ficha clínica, presupuestos, comisiones, IA y trabajo sin internet.";

export const Route = createFileRoute("/funciones/")({
  loader: async () => ({
    funciones: (await paginasPublicadas("funciones")).map(aEnlace),
    para: (await paginasPublicadas("para")).map(aEnlace),
  }),
  head: () => {
    const canonical = canonicalHead("/funciones");
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
  component: Funciones,
});

function Funciones() {
  const { funciones, para } = Route.useLoaderData();
  return (
    <IndiceContenido
      kicker="Funciones"
      titulo="Todo lo que hace Esmalia, explicado una función a la vez"
      intro="Cada página cuenta cómo funciona por dentro, qué plan la incluye y qué no hace. Si algo no está escrito acá, Esmalia no lo hace."
      grupos={[
        { titulo: "Funciones", paginas: funciones },
        { titulo: "Según tu clínica", paginas: para },
      ]}
    />
  );
}
