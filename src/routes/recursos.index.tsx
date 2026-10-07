import { createFileRoute, redirect } from "@tanstack/react-router";

// Redirección permanente: hoy hay un solo recurso. `recursos.index` y no
// `recursos.tsx`, porque este último sería el layout padre de
// /recursos/fugas-clinica-dental y la redirección lo alcanzaría también.
export const Route = createFileRoute("/recursos/")({
  beforeLoad: () => {
    throw redirect({ to: "/recursos/fugas-clinica-dental", statusCode: 301 });
  },
});
