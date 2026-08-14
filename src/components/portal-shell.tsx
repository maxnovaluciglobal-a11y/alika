import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { CalendarPlus, FileUp, Home, Stethoscope } from "lucide-react";
import { pacientePortal } from "@/lib/portal-data";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/portal", label: "Inicio", icon: Home, exact: true },
  { to: "/portal/reservar", label: "Reservar", icon: CalendarPlus, exact: false },
  { to: "/portal/tratamientos", label: "Tratamientos", icon: Stethoscope, exact: false },
  { to: "/portal/documentos", label: "Documentos", icon: FileUp, exact: false },
] as const;

export function PortalShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const paciente = pacientePortal();
  const iniciales = paciente.nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");

  return (
    <div className="min-h-screen bg-surface text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col border-border/60 sm:max-w-lg sm:border-x">
        <header className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand">
              <span className="size-3.5 rounded-full border-2 border-brand-foreground" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold tracking-tight text-brand">Alika</p>
              <p className="truncate text-xs text-muted-foreground">Portal del paciente</p>
            </div>
          </div>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
            {iniciales}
          </span>
        </header>

        <main className="flex-1 px-4 pb-28 pt-4">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-border/60 bg-background/95 backdrop-blur sm:max-w-lg">
          <ul className="grid grid-cols-4">
            {tabs.map((tab) => {
              const activo = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
              return (
                <li key={tab.to}>
                  <Link
                    to={tab.to}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                      activo ? "text-brand" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <tab.icon className="size-5" />
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
