import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarPlus, ChevronRight, Clock, FileUp, MapPin, X } from "lucide-react";
import {
  citasDelPaciente,
  formatoFechaCorta,
  nombreProfesional,
  nombreSucursal,
  pacientePortal,
  tratamientosDelPaciente,
} from "@/lib/portal-data";
import { etiquetaEstado, etiquetaEstadoTratamiento, formatoMoneda } from "@/lib/clinic-data";
import { usePortal } from "@/lib/portal-store";

export const Route = createFileRoute("/portal/")({
  head: () => ({
    meta: [
      { title: "Mi clínica · Portal Alika" },
      { name: "description", content: "Resumen de tus próximas citas, tratamientos activos y saldo en la clínica." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalInicio,
});

function PortalInicio() {
  const paciente = pacientePortal();
  const { reservas, cancelarReserva } = usePortal();
  const proximas = citasDelPaciente().filter((c) => c.estado !== "finalizada");
  const activos = tratamientosDelPaciente().filter((t) => t.estado !== "finalizado");

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-2xl font-bold tracking-tight">Hola, {paciente.nombre.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {proximas.length + reservas.length > 0
            ? "Tienes atenciones agendadas. Revisa los detalles abajo."
            : "No tienes citas agendadas. Reserva cuando quieras."}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <p className="text-xs text-muted-foreground">Saldo pendiente</p>
          <p className="mt-1 font-display text-lg font-bold">{formatoMoneda(paciente.saldo ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-3">
          <p className="text-xs text-muted-foreground">Tratamientos activos</p>
          <p className="mt-1 font-display text-lg font-bold">{activos.length}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Mis próximas citas</h2>

        {reservas.map((r) => (
          <article key={r.id} className="rounded-xl border border-brand/40 bg-brand-soft/50 p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{r.motivo}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5 shrink-0" /> {formatoFechaCorta(r.fecha)} · {r.hora}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {nombreSucursal(r.sucursalId)} · {nombreProfesional(r.profesionalId)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => cancelarReserva(r.id)}
                aria-label="Cancelar reserva"
                className="shrink-0 rounded-lg border border-border/60 bg-background p-1.5 text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            </div>
          </article>
        ))}

        {proximas.map((c) => (
          <article key={c.id} className="rounded-xl border border-border/60 bg-card p-4">
            <p className="truncate text-sm font-semibold">{c.tratamiento}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5 shrink-0" /> {formatoFechaCorta(c.fecha)} · {c.hora}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">
                {nombreSucursal(c.sucursalId)} · {nombreProfesional(c.profesionalId)}
              </span>
            </p>
            <span className="mt-3 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {etiquetaEstado[c.estado]}
            </span>
          </article>
        ))}

        {proximas.length === 0 && reservas.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
            Aún no tienes citas agendadas.
          </p>
        )}
      </section>

      <section className="grid gap-3">
        <Link
          to="/portal/reservar"
          className="flex items-center gap-3 rounded-xl bg-brand px-4 py-3 text-sm font-medium text-brand-foreground"
        >
          <CalendarPlus className="size-5 shrink-0" />
          <span className="flex-1">Reservar una hora</span>
          <ChevronRight className="size-4 shrink-0" />
        </Link>
        <Link
          to="/portal/documentos"
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm font-medium"
        >
          <FileUp className="size-5 shrink-0 text-brand" />
          <span className="flex-1">Enviar documentación</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </section>

      {activos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">En curso</h2>
          {activos.map((t) => (
            <Link
              key={t.id}
              to="/portal/tratamientos"
              className="block rounded-xl border border-border/60 bg-card p-4"
            >
              <p className="truncate text-sm font-semibold">{t.plan}</p>
              <p className="mt-1 text-xs text-muted-foreground">{etiquetaEstadoTratamiento[t.estado]}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand" style={{ width: `${t.avance}%` }} />
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
