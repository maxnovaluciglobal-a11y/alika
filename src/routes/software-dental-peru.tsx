import { createFileRoute } from "@tanstack/react-router";

import { cargarPagina, headDePagina, VistaPagina } from "@/lib/marketing/ruta-contenido";

// Contenido en src/content/paginas/pais-peru.ts.
export const Route = createFileRoute("/software-dental-peru")({
  loader: () => cargarPagina("/software-dental-peru"),
  head: ({ loaderData }) => headDePagina(loaderData),
  component: Pagina,
});

function Pagina() {
  return <VistaPagina datos={Route.useLoaderData()} />;
}
