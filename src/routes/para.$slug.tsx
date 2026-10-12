import { createFileRoute } from "@tanstack/react-router";

import { cargarPagina, headDePagina, VistaPagina } from "@/lib/marketing/ruta-contenido";

// Páginas de src/content/paginas/ con path "/para/<slug>".
export const Route = createFileRoute("/para/$slug")({
  loader: ({ params }) => cargarPagina(`/para/${params.slug}`),
  head: ({ loaderData }) => headDePagina(loaderData),
  component: Pagina,
});

function Pagina() {
  return <VistaPagina datos={Route.useLoaderData()} />;
}
