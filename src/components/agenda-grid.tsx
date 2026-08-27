import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { AllergyAlertIcon } from "@/components/medical-history-card";
import {
  etiquetaEstado,
  HORAS_VISIBLES,
  HORA_INICIO,
  PIXELES_POR_MINUTO,
  type Cita,
  type Profesional,
} from "@/lib/clinic-data";
import { cn } from "@/lib/utils";

// El borde izquierdo identifica al profesional (color guardado en
// /profesionales, ver AgendaGrid más abajo); acá solo queda fondo + texto
// según el estado de la cita.
const estadoClases: Record<Cita["estado"], string> = {
  confirmada: "bg-brand/10 text-brand",
  "en-sala": "bg-warning-soft text-warning",
  ausente: "bg-secondary text-muted-foreground",
  finalizada: "bg-secondary/60 text-muted-foreground",
  tentativa: "bg-ai-soft text-ai",
};

function horaLabel(i: number) {
  return `${String(HORA_INICIO + i).padStart(2, "0")}:00`;
}

export function AgendaGrid({
  compacta = false,
  citas,
  profesionales,
  allergyAlerts,
}: {
  compacta?: boolean;
  citas: Cita[];
  profesionales: Profesional[];
  /** patientId -> alergias. Ausente/vacío = sin aviso (ver
   * listAllergyAlerts en medical-history.functions.ts). */
  allergyAlerts?: Record<string, string[]>;
}) {
  const alto = HORAS_VISIBLES * 60 * PIXELES_POR_MINUTO;

  if (profesionales.length === 0) {
    return (
      <div className="card-clinical grid place-items-center px-5 py-16 text-center text-sm text-muted-foreground">
        No hay profesionales que coincidan con los filtros seleccionados.
      </div>
    );
  }

  return (
    <div className="card-clinical overflow-hidden">
      <div
        className="grid border-b border-hairline bg-secondary/40"
        style={{ gridTemplateColumns: `72px repeat(${profesionales.length}, minmax(0, 1fr))` }}
      >
        <div className="p-3" />
        {profesionales.map((p) => (
          <div key={p.id} className="border-l border-hairline p-3 text-center">
            <p className="text-xs font-semibold">
              {p.nombre} <span className="font-normal text-muted-foreground">({p.box})</span>
            </p>
            {!compacta && <p className="text-[10px] text-muted-foreground">{p.especialidad}</p>}
          </div>
        ))}
      </div>

      <div
        className="relative grid"
        style={{
          height: alto,
          gridTemplateColumns: `72px repeat(${profesionales.length}, minmax(0, 1fr))`,
        }}
      >
        <div className="flex flex-col pr-2 pt-1 text-right text-[10px] text-muted-foreground">
          {Array.from({ length: HORAS_VISIBLES }).map((_, i) => (
            <div
              key={i}
              style={{ height: 60 * PIXELES_POR_MINUTO }}
              className="border-b border-hairline"
            >
              {horaLabel(i)}
            </div>
          ))}
        </div>

        {profesionales.map((p) => (
          <div key={p.id} className="relative border-l border-hairline">
            {Array.from({ length: HORAS_VISIBLES }).map((_, i) => (
              <div
                key={i}
                style={{ height: 60 * PIXELES_POR_MINUTO }}
                className="border-b border-hairline"
              />
            ))}

            {citas
              .filter((c) => c.profesionalId === p.id)
              .map((c) => (
                <Link
                  key={c.id}
                  to="/pacientes/$pacienteId"
                  params={{ pacienteId: c.pacienteId }}
                  className={cn(
                    "absolute left-2 right-2 cursor-grab overflow-hidden rounded-md border p-2.5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    estadoClases[c.estado],
                    c.estado === "ausente" && "opacity-70",
                  )}
                  style={{
                    top: c.inicio * PIXELES_POR_MINUTO,
                    height: c.duracion * PIXELES_POR_MINUTO - 6,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold">
                      <span
                        aria-hidden="true"
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="truncate">{c.paciente}</span>
                      <AllergyAlertIcon allergies={allergyAlerts?.[c.pacienteId]} />
                    </p>
                    <span className="shrink-0 rounded bg-card/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-tight">
                      {etiquetaEstado[c.estado]}
                    </span>
                  </div>
                  {c.duracion >= 45 && (
                    <p className="truncate text-[10px] opacity-75">{c.tratamiento}</p>
                  )}
                  {c.prioridad && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded bg-ai/15 px-1.5 py-0.5 text-[9px] uppercase text-ai">
                      <Sparkles className="size-2.5" /> Prioridad
                    </span>
                  )}
                </Link>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
