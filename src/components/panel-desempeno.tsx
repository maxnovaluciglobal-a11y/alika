import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { formatMoney } from "@/lib/finance";
import { getPanelDesempeno, type PanelMes } from "@/lib/finance-reports.functions";
import { cn } from "@/lib/utils";

/**
 * Panel de desempeño de la clínica (G-7 del análisis competitivo).
 *
 * Lo que un dueño abre a la mañana. La regla que gobierna todo el componente:
 * **un indicador que no se puede calcular muestra "Sin datos", nunca un cero**.
 * Un panel vacío se ve mal; uno que dice 0 % de ocupación cuando en realidad
 * nadie cargó los horarios se ve como una catástrofe que no ocurrió.
 */

function Indicador({
  label,
  valor,
  nota,
  destacado,
}: {
  label: string;
  valor: string;
  nota?: string;
  destacado?: boolean;
}) {
  return (
    <div className="card-clinical p-4">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "font-display font-semibold tabular-nums",
          destacado ? "text-2xl" : "text-xl",
        )}
      >
        {valor}
      </p>
      {nota && <p className="mt-0.5 text-[11px] text-muted-foreground">{nota}</p>}
    </div>
  );
}

/**
 * Ventas contra recaudación, doce meses. Barras en SVG y no una librería de
 * charts: son dos series de doce valores y traer Recharts para esto agregaría
 * ~90 KB al bundle — y ya hubo un incidente con `Object.freeze` y Recharts en
 * este repo (ver la auditoría de agosto).
 */
function SerieMensual({ serie, currency }: { serie: PanelMes[]; currency: string }) {
  const max = Math.max(1, ...serie.flatMap((m) => [m.ventasCents, m.recaudacionCents]));
  const alto = 120;
  const anchoBarra = 100 / (serie.length * 2 + serie.length);

  const mesCorto = (mes: string) => {
    const [, m] = mes.split("-");
    return ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][
      Number(m) - 1
    ];
  };

  const totalVentas = serie.reduce((s, m) => s + m.ventasCents, 0);
  const totalRecaudacion = serie.reduce((s, m) => s + m.recaudacionCents, 0);

  return (
    <div className="card-clinical p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ventas y recaudación · 12 meses
        </p>
        <div className="flex gap-4 text-[11px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-brand" aria-hidden />
            Producción {formatMoney(totalVentas, currency)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-success" aria-hidden />
            Cobrado {formatMoney(totalRecaudacion, currency)}
          </span>
        </div>
      </div>

      {totalVentas === 0 && totalRecaudacion === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Todavía no hay producción ni cobros en los últimos doce meses.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 100 ${alto + 14}`}
            className="h-40 w-full min-w-[32rem]"
            role="img"
            aria-label={`Producción y cobros de los últimos doce meses. Producción total ${formatMoney(totalVentas, currency)}, cobrado ${formatMoney(totalRecaudacion, currency)}.`}
            preserveAspectRatio="none"
          >
            {serie.map((m, i) => {
              const x = i * (anchoBarra * 3);
              const hv = (m.ventasCents / max) * alto;
              const hr = (m.recaudacionCents / max) * alto;
              return (
                <g key={m.mes}>
                  <title>
                    {`${m.mes}: producción ${formatMoney(m.ventasCents, currency)}, cobrado ${formatMoney(m.recaudacionCents, currency)}`}
                  </title>
                  <rect
                    x={x}
                    y={alto - hv}
                    width={anchoBarra}
                    height={hv}
                    className="fill-brand"
                    rx={0.4}
                  />
                  <rect
                    x={x + anchoBarra + 0.4}
                    y={alto - hr}
                    width={anchoBarra}
                    height={hr}
                    className="fill-success"
                    rx={0.4}
                  />
                  <text
                    x={x + anchoBarra}
                    y={alto + 10}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    style={{ fontSize: 4 }}
                  >
                    {mesCorto(m.mes)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

export function PanelDesempeno({
  clinicId,
  desde,
  hasta,
}: {
  clinicId: string;
  desde: string;
  hasta: string;
}) {
  const fetchPanel = useServerFn(getPanelDesempeno);
  const { data, isLoading, error } = useQuery({
    queryKey: ["panel-desempeno", clinicId, desde, hasta],
    queryFn: () => fetchPanel({ data: { clinicId, desde, hasta } }),
  });

  const indicadores = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: "Pacientes nuevos",
        valor: String(data.pacientesNuevos),
        nota: "Primera cita en el período",
      },
      {
        label: "Citas anuladas",
        valor: String(data.citasAnuladas),
        nota: `de ${data.citasAgendadas + data.citasAnuladas} agendadas`,
      },
      {
        label: "Atendidos vs. agendados",
        valor: data.tasaAsistencia === null ? "Sin datos" : `${data.tasaAsistencia}%`,
        nota:
          data.tasaAsistencia === null
            ? "No hubo citas en el período"
            : `${data.citasAtendidas} de ${data.citasAgendadas}`,
      },
      {
        label: "Ocupación",
        valor: data.ocupacionPct === null ? "Sin datos" : `${data.ocupacionPct}%`,
        nota:
          data.ocupacionPct === null
            ? "Cargá horarios de los profesionales"
            : "Horas agendadas sobre disponibles",
      },
      {
        label: "Presupuestos emitidos",
        valor: String(data.presupuestosEmitidos),
      },
      {
        label: "Espera promedio",
        valor: data.esperaPromedioMin === null ? "Sin datos" : `${data.esperaPromedioMin} min`,
        nota:
          data.esperaPromedioMin === null
            ? "Nadie registró llegada e inicio"
            : `Sobre ${data.esperaMuestras} ${data.esperaMuestras === 1 ? "atención" : "atenciones"}`,
      },
    ];
  }, [data]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando panel…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        No pudimos cargar el panel de desempeño. Recargá la página; si sigue igual, avisá al equipo.
      </p>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Indicador
          label="Producción del período"
          valor={formatMoney(data.ventasCents, data.currency)}
          nota="Tratamientos completados"
          destacado
        />
        <Indicador
          label="Cobrado en el período"
          valor={formatMoney(data.recaudacionCents, data.currency)}
          nota="Pagos recibidos"
          destacado
        />
        <Indicador
          label="Diferencia"
          valor={formatMoney(data.ventasCents - data.recaudacionCents, data.currency)}
          nota={
            data.ventasCents > data.recaudacionCents
              ? "Trabajo hecho que falta cobrar"
              : "Cobrado por sobre lo producido"
          }
          destacado
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {indicadores.map((i) => (
          <Indicador key={i.label} {...i} />
        ))}
      </section>

      <SerieMensual serie={data.serie} currency={data.currency} />
    </div>
  );
}
