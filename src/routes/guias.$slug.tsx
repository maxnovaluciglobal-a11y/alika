import { createFileRoute } from "@tanstack/react-router";

import { cargarPagina, headDePagina, VistaPagina } from "@/lib/marketing/ruta-contenido";

// Páginas de src/content/paginas/ con path "/guias/<slug>".
export const Route = createFileRoute("/guias/$slug")({
  loader: ({ params }) => cargarPagina(`/guias/${params.slug}`),
  head: ({ loaderData }) => headDePagina(loaderData),
  component: Pagina,
});

function Pagina() {
  return <VistaPagina datos={Route.useLoaderData()} />;
}
