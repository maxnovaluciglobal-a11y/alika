import { createFileRoute, redirect } from "@tanstack/react-router";

// Redirección temporal (307): hoy hay un solo recurso, pero /recursos va a
// ser un índice cuando haya más, así que no se fija como 301 en buscadores
// ni en cachés. `recursos.index` y no `recursos.tsx`, porque este último
// sería el layout padre de /recursos/fugas-clinica-dental y la redirección
// lo alcanzaría también.
export const Route = createFileRoute("/recursos/")({
  beforeLoad: () => {
    throw redirect({ to: "/recursos/fugas-clinica-dental", statusCode: 307 });
  },
});
