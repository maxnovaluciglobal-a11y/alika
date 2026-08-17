import { Outlet, createFileRoute } from "@tanstack/react-router";

/**
 * Portal del paciente v2 (Opción C): la clínica manda un link firmado por
 * WhatsApp `alika.com/portal/<jwt>`. La ruta `/portal/$token` valida el
 * token y setea cookie HttpOnly; después `/portal/inicio` muestra las
 * citas + solicitar hora sin login.
 *
 * Este layout es un pass-through: solo renderiza Outlet. Sin
 * autenticación aquí — cada ruta hija decide si necesita cookie de
 * sesión (portal.inicio la requiere; portal.$token la crea).
 */
export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Portal del paciente · Alika" },
      {
        name: "description",
        content: "Reserva horas y revisa tus tratamientos desde el portal de tu clínica dental.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <Outlet />,
});
