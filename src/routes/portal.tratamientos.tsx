import { createFileRoute } from "@tanstack/react-router";
import { etiquetaEstadoTratamiento, formatoFecha } from "@/lib/clinic-data";
import { nombreProfesional, nombreSucursal, pacientePortal, tratamientosDelPaciente } from "@/lib/portal-data";

export const Route = createFileRoute("/portal/tratamientos")({
  head: () => ({
    meta: [
      { title: "Mis tratamientos · Portal Alika" },
      { name: "description", content: "Revisa el avance de tus planes de tratamiento y tu historial de atención." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalTratamientos,
});

function PortalTratamientos() {
  const paciente = pacientePortal();
  const planes = tratamientosDelPaciente();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Mis tratamientos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Avance de cada plan y tu historial clínico.</p>
      </div>

      <section className="space-y-3">
        {planes.map((t) => (
          <article key={t.id} className="rounded-xl border border-border/60 bg-card p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <p className="min-w-0 text-sm font-semibold">{t.plan}</p>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {etiquetaEstadoTratamiento[t.estado]}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {nombreProfesional(t.profesionalId)} · {nombreSucursal(t.sucursalId)}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand" style={{ width: `${t.avance}%` }} />
              </div>
              <span className="shrink-0 text-xs font-medium">{t.avance}%</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Inicio: {formatoFecha(t.fecha)}</p>
          </article>
        ))}
        {planes.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
            Todavía no tienes planes de tratamiento registrados.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Historial</h2>
        <ol className="space-y-3 border-l border-border/60 pl-4">
          {paciente.timeline.map((e, i) => (
            <li key={`${e.fecha}-${i}`} className="relative">
              <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-brand" />
              <p className="text-sm font-medium">{e.titulo}</p>
              <p className="text-xs text-muted-foreground">{e.fecha}</p>
              {e.detalle && <p className="mt-1 text-xs text-muted-foreground">{e.detalle}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
