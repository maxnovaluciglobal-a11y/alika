import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ajustesVisibles } from "@/lib/access/navegacion";

/**
 * Índice de Ajustes (rediseño, fase 3): las 17 páginas de configuración que
 * antes ocupaban dos grupos del sidebar quedan acá, agrupadas por tarea.
 * Cada enlace respeta el permiso de su propia ruta (ver `navegacion.ts`).
 */
export const Route = createFileRoute("/_authenticated/_clinic/ajustes")({
  head: () => ({
    meta: [{ title: "Ajustes | Alika" }, { name: "robots", content: "noindex" }],
  }),
  component: AjustesPage,
});

function AjustesPage() {
  const { access } = Route.useRouteContext();
  const grupos = ajustesVisibles(access.role);

  return (
    <AppShell title="Ajustes" access={access}>
      <div className="mx-auto max-w-4xl space-y-10">
        {grupos.map((g) => (
          <section key={g.titulo} aria-labelledby={`ajustes-${g.titulo}`}>
            <h2 id={`ajustes-${g.titulo}`} className="kicker">
              {g.titulo}
            </h2>
            <ul className="mt-3 divide-y divide-hairline border-y border-border">
              {g.items.map((i) => (
                <li key={i.to}>
                  <Link
                    to={i.to}
                    className="group flex items-center gap-4 py-3.5 transition-colors hover:text-brand-700"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-lg font-semibold leading-tight">
                        {i.label}
                      </span>
                      <span className="block text-sm text-muted-foreground">{i.detalle}</span>
                    </span>
                    <ChevronRight
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
