import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal-shell";
import { PortalProvider } from "@/lib/portal-store";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Portal del paciente · Alika" },
      {
        name: "description",
        content: "Reserva turnos, revisa tus tratamientos y envía documentación a tu clínica dental desde el celular.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalLayout,
});

function PortalLayout() {
  return (
    <PortalProvider>
      <PortalShell />
    </PortalProvider>
  );
}
