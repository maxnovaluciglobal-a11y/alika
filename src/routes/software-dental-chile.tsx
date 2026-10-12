import { createFileRoute } from "@tanstack/react-router";

import { cargarPagina, headDePagina, VistaPagina } from "@/lib/marketing/ruta-contenido";

// Contenido en src/content/paginas/pais-chile.ts.
export const Route = createFileRoute("/software-dental-chile")({
  loader: () => cargarPagina("/software-dental-chile"),
  head: ({ loaderData }) => headDePagina(loaderData),
  component: Pagina,
});

function Pagina() {
  return <VistaPagina datos={Route.useLoaderData()} />;
}
