import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { requirePermission } from "@/lib/route-guards";
import { AgendaGrid } from "@/components/agenda-grid";
import { PacienteTimeline } from "@/components/paciente-timeline";
import { HOY, kpis, pacientes } from "@/lib/clinic-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_clinic/dashboard")({
  beforeLoad: requirePermission("dashboard:view"),
  head: () => ({
    meta: [
      { title: "Dashboard clínico | Oralia" },
      {
        name: "description",
        content:
          "Oralia: KPIs en vivo, agenda del día y lectura de IA sobre lo que está pasando en tu clínica dental.",
      },
      { property: "og:title", content: "Dashboard clínico | Oralia" },
      {
        property: "og:description",
        content: "KPIs en vivo, agenda del día y lectura de IA de tu clínica dental.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { access } = Route.useRouteContext();
  const paciente = pacientes[0];

  return (
    <AppShell title="Vista de clínica" access={access}>
      <div className="space-y-8">
        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="card-clinical p-5">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{k.label}</p>
              <p className="font-display text-3xl font-bold">{k.valor}</p>
              <div
                className={cn(
                  "mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
                  k.tono === "success" && "bg-success-soft text-success",
                  k.tono === "brand" && "bg-brand-soft text-brand",
                  k.tono === "neutral" && "bg-secondary text-muted-foreground",
                )}
              >
                {k.nota}
              </div>
            </div>
          ))}
          <div className="rounded-2xl bg-brand p-5 text-brand-foreground">
            <p className="mb-1 text-xs font-medium opacity-75">Urgencias</p>
            <p className="font-display text-3xl font-bold">2</p>
            <p className="mt-2 text-[10px] opacity-85">Pendientes de asignar box</p>
          </div>
        </section>

        <div className="grid gap-8 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Agenda: jueves 24 oct</h2>
              <Link
                to="/agenda"
                search={{ q: "", fecha: HOY, sucursal: "", profesional: "", estado: "", page: 1 }}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
              >
                Abrir agenda
              </Link>
            </div>
            <AgendaGrid compacta />
          </div>

          <div className="space-y-4 xl:col-span-4">
            <h2 className="font-display text-xl font-semibold text-muted-foreground">Timeline clínico</h2>
            <div className="card-clinical space-y-6 p-6">
              <PacienteTimeline paciente={paciente} />
              <div className="border-t border-hairline pt-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-ai">
                  <Sparkles className="size-3" /> Análisis predictivo IA
                </p>
                <p className="text-xs italic text-muted-foreground">“{paciente.resumenIA}”</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
