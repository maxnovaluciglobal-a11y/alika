import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { PermissionsMatrix } from "@/components/permissions-matrix";
import { requirePermission } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/_clinic/permisos")({
  beforeLoad: requirePermission("team:manage"),
  head: () => ({
    meta: [
      { title: "Matriz de permisos | Alika" },
      {
        name: "description",
        content:
          "Consulta qué acciones puede realizar cada rol de la clínica según el estado de la nota clínica.",
      },
      { property: "og:title", content: "Matriz de permisos | Alika" },
      {
        property: "og:description",
        content: "Permisos por rol y por estado de la nota clínica en Alika.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PermisosPage,
});

function PermisosPage() {
  const { access } = Route.useRouteContext();
  return (
    <AppShell title="Matriz de permisos" access={access}>
      <PermissionsMatrix />
    </AppShell>
  );
}
