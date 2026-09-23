import { Outlet, createFileRoute } from "@tanstack/react-router";

/**
 * Portal externo de laboratorio: la clínica genera un link firmado
 * `alika.com/portal-laboratorio/<jwt>` desde `/laboratorios`. La ruta
 * `/portal-laboratorio/$token` valida el token y setea cookie HttpOnly;
 * después `/portal-laboratorio/inicio` muestra las órdenes sin login.
 * Mismo patrón que `/portal` (paciente) — ver ese layout para el porqué.
 */
export const Route = createFileRoute("/portal-laboratorio")({
  head: () => ({
    meta: [{ title: "Portal de laboratorio · Alika" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <Outlet />,
});
