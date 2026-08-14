import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import {
  diasDisponibles,
  formatoFechaCorta,
  horasDisponibles,
  motivosConsulta,
  nombreProfesional,
  nombreSucursal,
  profesionalesDeSucursal,
  sucursalesPortal,
} from "@/lib/portal-data";
import { usePortal } from "@/lib/portal-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/reservar")({
  head: () => ({
    meta: [
      { title: "Reservar hora · Portal Alika" },
      { name: "description", content: "Elige sucursal, profesional, día y hora para agendar tu próxima atención." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Reservar,
});

function Reservar() {
  const { agregarReserva } = usePortal();
  const [sucursalId, setSucursalId] = useState(sucursalesPortal[0]!.id);
  const [profesionalId, setProfesionalId] = useState(profesionalesDeSucursal(sucursalesPortal[0]!.id)[0]!.id);
  const [motivo, setMotivo] = useState(motivosConsulta[0]!);
  const [fecha, setFecha] = useState(diasDisponibles()[0]!);
  const [hora, setHora] = useState<string | null>(null);
  const [confirmada, setConfirmada] = useState<{ fecha: string; hora: string } | null>(null);

  const profesionales = profesionalesDeSucursal(sucursalId);
  const dias = diasDisponibles();
  const horas = horasDisponibles(fecha, profesionalId);

  function cambiarSucursal(id: string) {
    setSucursalId(id);
    setProfesionalId(profesionalesDeSucursal(id)[0]!.id);
    setHora(null);
  }

  function confirmar() {
    if (!hora) return;
    agregarReserva({ fecha, hora, motivo, profesionalId, sucursalId });
    setConfirmada({ fecha, hora });
  }

  if (confirmada) {
    return (
      <div className="space-y-5 py-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-brand" />
        <h1 className="font-display text-xl font-bold tracking-tight">Reserva confirmada</h1>
        <p className="text-sm text-muted-foreground">
          {formatoFechaCorta(confirmada.fecha)} a las {confirmada.hora} con {nombreProfesional(profesionalId)} en{" "}
          {nombreSucursal(sucursalId)}.
        </p>
        <p className="text-xs text-muted-foreground">Te enviaremos un recordatorio por WhatsApp 24 horas antes.</p>
        <div className="grid gap-2">
          <Link to="/portal" className="rounded-xl bg-brand px-4 py-3 text-sm font-medium text-brand-foreground">
            Volver al inicio
          </Link>
          <button
            type="button"
            onClick={() => {
              setConfirmada(null);
              setHora(null);
            }}
            className="rounded-xl border border-border/60 px-4 py-3 text-sm font-medium"
          >
            Reservar otra hora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Reservar hora</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cuatro pasos y listo.</p>
      </div>

      <Paso numero={1} titulo="Sucursal">
        <div className="grid gap-2">
          {sucursalesPortal.map((s) => (
            <Opcion key={s.id} activo={s.id === sucursalId} onClick={() => cambiarSucursal(s.id)}>
              <span className="font-medium">{s.nombre}</span>
              <span className="block text-xs text-muted-foreground">{s.ciudad}</span>
            </Opcion>
          ))}
        </div>
      </Paso>

      <Paso numero={2} titulo="Profesional">
        <div className="grid gap-2">
          {profesionales.map((p) => (
            <Opcion
              key={p.id}
              activo={p.id === profesionalId}
              onClick={() => {
                setProfesionalId(p.id);
                setHora(null);
              }}
            >
              <span className="font-medium">{p.nombre}</span>
              <span className="block text-xs text-muted-foreground">{p.especialidad}</span>
            </Opcion>
          ))}
        </div>
      </Paso>

      <Paso numero={3} titulo="Motivo">
        <select
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="w-full rounded-xl border border-border/60 bg-background px-3 py-3 text-sm"
        >
          {motivosConsulta.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Paso>

      <Paso numero={4} titulo="Día y hora">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {dias.map((d) => {
            const activo = d === fecha;
            const etiqueta = formatoFechaCorta(d).split(" ");
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setFecha(d);
                  setHora(null);
                }}
                className={cn(
                  "shrink-0 rounded-xl border px-3 py-2 text-center text-xs transition-colors",
                  activo ? "border-brand bg-brand text-brand-foreground" : "border-border/60 bg-card",
                )}
              >
                <span className="block capitalize">{etiqueta[0]}</span>
                <span className="block text-sm font-semibold">{etiqueta[1]}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {horas.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHora(h)}
              className={cn(
                "rounded-xl border py-2.5 text-sm font-medium transition-colors",
                h === hora ? "border-brand bg-brand text-brand-foreground" : "border-border/60 bg-card",
              )}
            >
              {h}
            </button>
          ))}
          {horas.length === 0 && (
            <p className="col-span-3 text-sm text-muted-foreground">Sin horas libres este día.</p>
          )}
        </div>
      </Paso>

      <button
        type="button"
        disabled={!hora}
        onClick={confirmar}
        className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-medium text-brand-foreground disabled:opacity-40"
      >
        {hora ? `Confirmar ${formatoFechaCorta(fecha)} · ${hora}` : "Selecciona una hora"}
      </button>
    </div>
  );
}

function Paso({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] text-brand">
          {numero}
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Opcion({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-4 py-3 text-left text-sm transition-colors",
        activo ? "border-brand bg-brand-soft/60" : "border-border/60 bg-card",
      )}
    >
      {children}
    </button>
  );
}
