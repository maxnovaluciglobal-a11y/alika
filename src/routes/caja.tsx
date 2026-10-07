import { createFileRoute, redirect } from "@tanstack/react-router";

// Redirección permanente: la pantalla se llama /cajas (ver precios.tsx).
export const Route = createFileRoute("/caja")({
  beforeLoad: () => {
    throw redirect({ to: "/cajas", statusCode: 301 });
  },
});
