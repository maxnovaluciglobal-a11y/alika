import { Link } from "@tanstack/react-router";

import {
  HORAS_VISIBLES,
  HORA_INICIO,
  PIXELES_POR_MINUTO,
  etiquetaEstado,
  type Cita,
} from "@/lib/clinic-data";
import { esMismoMesISO, monthGridISO, nroDiaISO, weekDaysISO } from "@/lib/agenda-fechas";
import { cn } from "@/lib/utils";

const estadoClases: Record<Cita["estado"], string> = {
  confirmada: "bg-brand/10 border-l-brand text-brand",
  "en-sala": "bg-warning-soft border-l-warning text-warning",
  ausente: "bg-secondary border-l-border text-muted-foreground",
  finalizada: "bg-secondary/60 border-l-border text-muted-foreground",
  tentativa: "bg-ai-soft border-l-ai text-ai",
};

const DOW_CORTO = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function horaLabel(i: number) {
  return `${String(HORA_INICIO + i).padStart(2, "0")}:00`;
}

// ── Vista semana: horas × 7 días ─────────────────────────────────────────
export function AgendaWeek({ citas, fecha, hoy }: { citas: Cita[]; fecha: string; hoy: string }) {
  const dias = weekDaysISO(fecha);
  const alto = HORAS_VISIBLES * 60 * PIXELES_POR_MINUTO;

  return (
    <div className="card-clinical overflow-x-auto">
      <div className="min-w-[720px]">
        <div
          className="grid border-b border-hairline bg-secondary/40"
          style={{ gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))` }}
        >
          <div className="p-2" />
          {dias.map((d, i) => (
            <div
              key={d}
              className={cn("border-l border-hairline p-2 text-center", d === hoy && "bg-brand/5")}
            >
              <p className="text-[11px] font-semibold capitalize">{DOW_CORTO[i]}</p>
              <p className={cn("text-[10px] text-muted-foreground", d === hoy && "text-brand")}>
                {nroDiaISO(d)}
              </p>
            </div>
          ))}
        </div>

        <div
          className="relative grid"
          style={{ height: alto, gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))` }}
        >
          <div className="flex flex-col pr-1 pt-1 text-right text-[10px] text-muted-foreground">
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

          {dias.map((d) => {
            const delDia = citas.filter((c) => c.fecha === d);
            return (
              <div
                key={d}
                className={cn("relative border-l border-hairline", d === hoy && "bg-brand/5")}
              >
                {Array.from({ length: HORAS_VISIBLES }).map((_, i) => (
                  <div
                    key={i}
                    style={{ height: 60 * PIXELES_POR_MINUTO }}
                    className="border-b border-hairline"
                  />
                ))}
                {delDia.map((c) => (
                  <Link
                    key={c.id}
                    to="/pacientes/$pacienteId"
                    params={{ pacienteId: c.pacienteId }}
                    title={`${c.paciente} · ${c.tratamiento}`}
                    className={cn(
                      "absolute left-0.5 right-0.5 overflow-hidden rounded border-l-2 px-1 py-0.5 text-[9px] leading-tight transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                      estadoClases[c.estado],
                      c.estado === "ausente" && "opacity-70",
                    )}
                    style={{
                      top: c.inicio * PIXELES_POR_MINUTO,
                      height: Math.max(c.duracion * PIXELES_POR_MINUTO - 2, 12),
                    }}
                  >
                    <span className="block truncate font-semibold">{c.paciente}</span>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Vista mes: calendario 6×7 ────────────────────────────────────────────
export function AgendaMonth({
  citas,
  fecha,
  hoy,
  onSelectDay,
}: {
  citas: Cita[];
  fecha: string;
  hoy: string;
  onSelectDay: (dia: string) => void;
}) {
  const celdas = monthGridISO(fecha);
  const porDia = new Map<string, Cita[]>();
  for (const c of citas) {
    const lista = porDia.get(c.fecha) ?? [];
    lista.push(c);
    porDia.set(c.fecha, lista);
  }

  return (
    <div className="card-clinical overflow-hidden">
      <div className="grid grid-cols-7 border-b border-hairline bg-secondary/40 text-center">
        {DOW_CORTO.map((d) => (
          <div key={d} className="p-2 text-[10px] font-semibold uppercase text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celdas.map((d) => {
          const delDia = (porDia.get(d) ?? []).sort((a, b) => a.inicio - b.inicio);
          const fueraDeMes = !esMismoMesISO(d, fecha);
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelectDay(d)}
              className={cn(
                "flex min-h-[92px] flex-col gap-0.5 border-b border-l border-hairline p-1.5 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                fueraDeMes && "bg-secondary/20 text-muted-foreground/60",
              )}
            >
              <span
                className={cn(
                  "text-[11px] font-semibold",
                  d === hoy &&
                    "inline-grid size-5 place-items-center rounded-full bg-brand text-brand-foreground",
                )}
              >
                {nroDiaISO(d)}
              </span>
              {delDia.slice(0, 3).map((c) => (
                <span
                  key={c.id}
                  className={cn(
                    "truncate rounded border-l-2 px-1 text-[9px] leading-tight",
                    estadoClases[c.estado],
                  )}
                  title={`${c.paciente} · ${etiquetaEstado[c.estado]}`}
                >
                  {c.paciente}
                </span>
              ))}
              {delDia.length > 3 && (
                <span className="text-[9px] text-muted-foreground">+{delDia.length - 3} más</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
