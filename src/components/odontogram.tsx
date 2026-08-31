import { Fragment, useMemo, useState, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Info, List, LayoutGrid, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import { useOfflineMutation } from "@/hooks/use-offline-mutation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CONDITION_COLORS,
  CONDITION_LABELS,
  FDI_LOWER_LEFT,
  FDI_LOWER_LEFT_PRIMARY,
  FDI_LOWER_RIGHT,
  FDI_LOWER_RIGHT_PRIMARY,
  FDI_UPPER_LEFT,
  FDI_UPPER_LEFT_PRIMARY,
  FDI_UPPER_RIGHT,
  FDI_UPPER_RIGHT_PRIMARY,
  SURFACE_LABELS,
  TOOTH_CONDITIONS,
  TOOTH_SURFACES,
  WHOLE_TOOTH_CONDITIONS,
  marksByTooth,
  toothCommonName,
  type OdontogramMark,
  type ToothCondition,
  type ToothSurface,
} from "@/lib/odontogram";
// Foco de teclado consistente con el patrón usado en app-shell.tsx
// (focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring).
const FOCUS_RING_CLASS =
  "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";
import {
  listOdontogramHistory,
  listOdontogramMarks,
  setOdontogramMark,
} from "@/lib/odontogram.functions";
import { cn } from "@/lib/utils";

const TOOTH_SIZE = 40;
const TOOTH_GAP = 4;
// Target táctil mínimo WCAG 2.5.8 (24x24px) para la zona oclusal. El dibujo
// visual del cuadrado central sigue siendo `inner` (~11.2px) para no romper
// el layout del diagrama FDI; solo el área que capta el click/tap se agranda.
const OCLUSAL_HIT_MIN = 24;

type ToothClick = { tooth: number; surface: ToothSurface };

/**
 * Pieza dental estilizada: cuadrado dividido en cuatro triángulos periféricos
 * (M/D/V/L) + un cuadrado central (O). El "whole" no tiene zona visible; la
 * elige el popover cuando la condición aplica a la pieza entera.
 */
function ToothCell({
  tooth,
  surfaces,
  onClick,
}: {
  tooth: number;
  surfaces: Partial<Record<ToothSurface, OdontogramMark>>;
  onClick: (click: ToothClick) => void;
}) {
  const s = TOOTH_SIZE;
  const c = s / 2;
  const inner = s * 0.28;
  const wholeCondition = surfaces.whole?.condition;
  const isWholeOverride = wholeCondition && WHOLE_TOOTH_CONDITIONS.includes(wholeCondition);
  const wholeColor = isWholeOverride ? CONDITION_COLORS[wholeCondition] : null;

  // Activa la misma acción que el click: usada tanto por onClick (mouse/touch)
  // como por onKeyDown (Enter/Space) de cada superficie enfocable.
  function activate(click: ToothClick) {
    onClick(click);
  }

  function handleKeyDown(e: KeyboardEvent<SVGElement>, click: ToothClick) {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      e.stopPropagation();
      activate(click);
    }
  }

  const nombreComun = toothCommonName(tooth);
  const piezaLabel = nombreComun ? `Diente ${tooth} (${nombreComun})` : `Diente ${tooth}`;

  function surfaceLabel(surface: Exclude<ToothSurface, "whole">) {
    const condition = surfaces[surface]?.condition ?? "sano";
    return `${piezaLabel}, superficie ${SURFACE_LABELS[surface]}, ${CONDITION_LABELS[condition]}`;
  }

  const wholeLabel = wholeColor
    ? `${piezaLabel}, pieza completa, ${CONDITION_LABELS[wholeCondition as ToothCondition]}`
    : `${piezaLabel}, marcar condición de la pieza completa`;

  const zones: {
    surface: ToothSurface;
    points: string;
    color: string;
  }[] = [
    {
      surface: "vestibular",
      points: `0,0 ${s},0 ${c + inner / 2},${c - inner / 2} ${c - inner / 2},${c - inner / 2}`,
      color: surfaces.vestibular
        ? CONDITION_COLORS[surfaces.vestibular.condition]
        : CONDITION_COLORS.sano,
    },
    {
      surface: "distal",
      points: `${s},0 ${s},${s} ${c + inner / 2},${c + inner / 2} ${c + inner / 2},${c - inner / 2}`,
      color: surfaces.distal ? CONDITION_COLORS[surfaces.distal.condition] : CONDITION_COLORS.sano,
    },
    {
      surface: "lingual",
      points: `0,${s} ${s},${s} ${c + inner / 2},${c + inner / 2} ${c - inner / 2},${c + inner / 2}`,
      color: surfaces.lingual
        ? CONDITION_COLORS[surfaces.lingual.condition]
        : CONDITION_COLORS.sano,
    },
    {
      surface: "mesial",
      points: `0,0 0,${s} ${c - inner / 2},${c + inner / 2} ${c - inner / 2},${c - inner / 2}`,
      color: surfaces.mesial ? CONDITION_COLORS[surfaces.mesial.condition] : CONDITION_COLORS.sano,
    },
  ];

  const oclusalColor = surfaces.oclusal
    ? CONDITION_COLORS[surfaces.oclusal.condition]
    : CONDITION_COLORS.sano;
  // Clampeado a `s` (40px) para no salirse del viewBox del diente.
  const oclusalHitSize = Math.min(OCLUSAL_HIT_MIN, s);

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="font-mono text-[10px] text-muted-foreground"
        title={nombreComun ? `${tooth} · ${nombreComun}` : undefined}
      >
        {tooth}
      </span>
      <svg
        width={s}
        height={s}
        viewBox={`0 0 ${s} ${s}`}
        className="cursor-pointer overflow-visible rounded-sm border border-hairline transition-colors hover:border-brand"
        role="group"
        aria-label={piezaLabel}
      >
        {wholeColor && (
          <rect
            x={0}
            y={0}
            width={s}
            height={s}
            fill={wholeColor}
            opacity={0.85}
            tabIndex={0}
            role="button"
            aria-label={wholeLabel}
            className={FOCUS_RING_CLASS}
            onClick={() => activate({ tooth, surface: "whole" })}
            onKeyDown={(e) => handleKeyDown(e, { tooth, surface: "whole" })}
          />
        )}
        {!wholeColor &&
          zones.map((z) => (
            <polygon
              key={z.surface}
              points={z.points}
              fill={z.color}
              stroke="rgba(0,0,0,0.08)"
              strokeWidth={0.5}
              tabIndex={0}
              role="button"
              aria-label={surfaceLabel(z.surface as Exclude<ToothSurface, "whole">)}
              className={FOCUS_RING_CLASS}
              onClick={(e) => {
                e.stopPropagation();
                activate({ tooth, surface: z.surface });
              }}
              onKeyDown={(e) => handleKeyDown(e, { tooth, surface: z.surface })}
            />
          ))}
        {!wholeColor && (
          <rect
            x={c - inner / 2}
            y={c - inner / 2}
            width={inner}
            height={inner}
            fill={oclusalColor}
            stroke="rgba(0,0,0,0.12)"
            strokeWidth={0.5}
            pointerEvents="none"
          />
        )}
        {/* Hit-area invisible de la zona oclusal, agrandada a 24x24px mínimo
            (WCAG 2.5.8) por encima del cuadrado visual sin modificarlo. Es el
            elemento enfocable real de la superficie oclusal (el cuadrado
            visual de arriba es puramente decorativo, pointerEvents none). */}
        {!wholeColor && (
          <rect
            x={c - oclusalHitSize / 2}
            y={c - oclusalHitSize / 2}
            width={oclusalHitSize}
            height={oclusalHitSize}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={surfaceLabel("oclusal")}
            className={FOCUS_RING_CLASS}
            onClick={(e) => {
              e.stopPropagation();
              activate({ tooth, surface: "oclusal" });
            }}
            onKeyDown={(e) => handleKeyDown(e, { tooth, surface: "oclusal" })}
          />
        )}
        {/* Zona invisible para marcar "whole" cuando aún no hay override — click en borde superior.
            También el punto de entrada por teclado a "pieza completa": el foco visible puede
            recortarse por overflow del layout de la fila (overflow-x: auto en el contenedor
            padre), es una limitación conocida documentada en el reporte de esta tarea. */}
        {!wholeColor && (
          <rect
            x={0}
            y={-6}
            width={s}
            height={6}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={wholeLabel}
            className={FOCUS_RING_CLASS}
            onClick={() => activate({ tooth, surface: "whole" })}
            onKeyDown={(e) => handleKeyDown(e, { tooth, surface: "whole" })}
          />
        )}
      </svg>
    </div>
  );
}

/**
 * Equivalente textual/tabular del diagrama FDI (WCAG 1.3.1/2.4.6 — el
 * gráfico no tenía ninguna alternativa de resumen: la única forma de saber
 * qué piezas tienen algo marcado era pasar foco por las 160 celdas
 * individuales del SVG, una por una). Una fila por pieza CON al menos una
 * marca distinta de "sano"; las piezas sanas no suman filas — sería puro
 * ruido para escanear.
 */
function TablaOdontograma({
  teeth,
  byTooth,
}: {
  teeth: readonly number[];
  byTooth: Map<number, Partial<Record<ToothSurface, OdontogramMark>>>;
}) {
  const filas = teeth
    .map((tooth) => {
      const marcas = byTooth.get(tooth) ?? {};
      const condiciones = TOOTH_SURFACES.filter(
        (s) => marcas[s] && marcas[s]!.condition !== "sano",
      );
      return { tooth, marcas, condiciones };
    })
    .filter((f) => f.condiciones.length > 0);

  if (filas.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin condiciones registradas todavía — todas las piezas figuran sanas.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">
          Piezas con al menos una condición distinta de sano, con su superficie y diagnóstico
        </caption>
        <thead>
          <tr className="border-b border-hairline text-[10px] uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-semibold">
              Pieza
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              Nombre común
            </th>
            <th scope="col" className="py-2 font-semibold">
              Condiciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {filas.map(({ tooth, marcas, condiciones }) => (
            <tr key={tooth}>
              <th scope="row" className="py-2 pr-3 font-mono font-medium">
                {tooth}
              </th>
              <td className="py-2 pr-3 text-muted-foreground">{toothCommonName(tooth) ?? "—"}</td>
              <td className="py-2">
                <ul className="flex flex-wrap gap-x-3 gap-y-1">
                  {condiciones.map((s) => (
                    <li key={s} className="inline-flex items-center gap-1">
                      <span
                        aria-hidden
                        className="size-2.5 rounded-sm border border-hairline"
                        style={{ backgroundColor: CONDITION_COLORS[marcas[s]!.condition] }}
                      />
                      <span className="text-muted-foreground">{SURFACE_LABELS[s]}:</span>{" "}
                      <span className="font-medium">{CONDITION_LABELS[marcas[s]!.condition]}</span>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ToothRow({
  teeth,
  byTooth,
  onClick,
}: {
  teeth: readonly number[];
  byTooth: Map<number, Partial<Record<ToothSurface, OdontogramMark>>>;
  onClick: (click: ToothClick) => void;
}) {
  return (
    <div className="flex items-center" style={{ gap: TOOTH_GAP }}>
      {teeth.map((t, i) => (
        <Fragment key={t}>
          <ToothCell tooth={t} surfaces={byTooth.get(t) ?? {}} onClick={onClick} />
          {i === teeth.length / 2 - 1 && <div className="mx-1 h-10 w-px bg-border" />}
        </Fragment>
      ))}
    </div>
  );
}

interface Props {
  clinicId: string;
  patientId: string;
  puedeEditar: boolean;
  userId: string;
}

export function Odontogram({ clinicId, patientId, puedeEditar, userId }: Props) {
  const queryClient = useQueryClient();
  const fetchMarks = useServerFn(listOdontogramMarks);
  const fetchHistory = useServerFn(listOdontogramHistory);
  const saveFn = useServerFn(setOdontogramMark);

  const [selection, setSelection] = useState<ToothClick | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [denticion, setDenticion] = useState<"permanente" | "temporal">("permanente");
  const [vista, setVista] = useState<"grafico" | "tabla">("grafico");

  const marksKey = ["odontogram-marks", clinicId, patientId];
  const historyKey = ["odontogram-history", clinicId, patientId];

  const { data: marks = [], isLoading } = useQuery({
    queryKey: marksKey,
    queryFn: () => fetchMarks({ data: { clinicId, patientId } }),
  });

  const { data: history = [] } = useQuery({
    queryKey: historyKey,
    enabled: showHistory,
    queryFn: () => fetchHistory({ data: { clinicId, patientId } }),
  });

  const byTooth = useMemo(() => marksByTooth(marks), [marks]);

  const save = useOfflineMutation<Record<string, unknown>>({
    kind: "marcar-odontograma",
    userId,
    ejecutar: (payload) => saveFn({ data: payload as never }),
    invalidar: [marksKey, historyKey],
    resumen: (payload) => {
      const p = payload as {
        toothNumber: number;
        surface: ToothSurface;
        condition: ToothCondition;
      };
      return `Pieza ${p.toothNumber} · ${SURFACE_LABELS[p.surface]} · ${CONDITION_LABELS[p.condition]}`;
    },
    identidad: (payload) => {
      const p = payload as { toothNumber: number; surface: ToothSurface };
      return `${patientId}:${p.toothNumber}:${p.surface}`;
    },
    esConflicto: (r) =>
      Boolean(r && typeof r === "object" && (r as { conflict?: boolean }).conflict),
    onExito: () => {
      setSelection(null);
      toast.success("Marca guardada");
    },
  });

  function marcar(condition: ToothCondition) {
    if (!selection) return;
    const vigente = byTooth.get(selection.tooth)?.[selection.surface];
    save.mutar({
      id: crypto.randomUUID(),
      clinicId,
      patientId,
      toothNumber: selection.tooth,
      surface: selection.surface,
      condition,
      baseMarkId: vigente?.id ?? null,
    });
  }

  const availableConditions =
    selection?.surface === "whole"
      ? TOOTH_CONDITIONS
      : TOOTH_CONDITIONS.filter((c) => !WHOLE_TOOTH_CONDITIONS.includes(c));

  return (
    <div className="card-clinical p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Odontograma</h3>
          <p className="text-xs text-muted-foreground">
            Numeración FDI · click en una superficie o en el borde superior para marcar la pieza
            entera.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-hairline p-0.5 text-xs">
            <button
              onClick={() => setDenticion("permanente")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium",
                denticion === "permanente"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Permanente
            </button>
            <button
              onClick={() => setDenticion("temporal")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium",
                denticion === "temporal"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Temporal
            </button>
          </div>
          <div className="flex rounded-lg border border-hairline p-0.5 text-xs">
            <button
              onClick={() => setVista("grafico")}
              aria-pressed={vista === "grafico"}
              title="Diagrama visual"
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium",
                vista === "grafico"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="size-3" /> Diagrama
            </button>
            <button
              onClick={() => setVista("tabla")}
              aria-pressed={vista === "tabla"}
              title="Lista de condiciones registradas — alternativa accesible al diagrama"
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium",
                vista === "tabla"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="size-3" /> Tabla
            </button>
          </div>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium hover:bg-secondary/60"
          >
            <History className="size-3" /> {showHistory ? "Ocultar historia" : "Ver historia"}
          </button>
        </div>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Cargando odontograma…</p>}

      {!isLoading && vista === "tabla" && (
        <TablaOdontograma
          teeth={
            denticion === "permanente"
              ? [...FDI_UPPER_RIGHT, ...FDI_UPPER_LEFT, ...FDI_LOWER_RIGHT, ...FDI_LOWER_LEFT]
              : [
                  ...FDI_UPPER_RIGHT_PRIMARY,
                  ...FDI_UPPER_LEFT_PRIMARY,
                  ...FDI_LOWER_RIGHT_PRIMARY,
                  ...FDI_LOWER_LEFT_PRIMARY,
                ]
          }
          byTooth={byTooth}
        />
      )}

      {!isLoading && vista === "grafico" && (
        <div className="space-y-4 overflow-x-auto">
          <div className="flex flex-col items-center gap-3">
            {denticion === "permanente" ? (
              <>
                <ToothRow
                  teeth={[...FDI_UPPER_RIGHT, ...FDI_UPPER_LEFT]}
                  byTooth={byTooth}
                  onClick={setSelection}
                />
                <ToothRow
                  teeth={[...FDI_LOWER_RIGHT, ...FDI_LOWER_LEFT]}
                  byTooth={byTooth}
                  onClick={setSelection}
                />
              </>
            ) : (
              <>
                <ToothRow
                  teeth={[...FDI_UPPER_RIGHT_PRIMARY, ...FDI_UPPER_LEFT_PRIMARY]}
                  byTooth={byTooth}
                  onClick={setSelection}
                />
                <ToothRow
                  teeth={[...FDI_LOWER_RIGHT_PRIMARY, ...FDI_LOWER_LEFT_PRIMARY]}
                  byTooth={byTooth}
                  onClick={setSelection}
                />
              </>
            )}
          </div>

          <p className="flex items-center gap-1.5 pt-2 text-[11px] text-muted-foreground">
            <Info className="size-3" />
            {denticion === "permanente"
              ? "Arriba: piezas 18→11 · 21→28. Abajo: 48→41 · 31→38."
              : "Arriba: piezas 55→51 · 61→65. Abajo: 85→81 · 71→75 (cuadrantes 5-8, notación FDI)."}{" "}
            Pasá el mouse sobre el número, o abrí una pieza, para ver su nombre común.
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-[10px] text-muted-foreground">
            {TOOTH_CONDITIONS.map((c) => (
              <span key={c} className="inline-flex items-center gap-1">
                <span
                  aria-hidden
                  className="size-3 rounded-sm border border-hairline"
                  style={{ backgroundColor: CONDITION_COLORS[c] }}
                />
                {CONDITION_LABELS[c]}
              </span>
            ))}
          </div>
        </div>
      )}

      {selection && (
        <Popover open onOpenChange={(o) => !o && setSelection(null)}>
          <PopoverTrigger asChild>
            <span className="sr-only">Selección abierta</span>
          </PopoverTrigger>
          <PopoverContent className="w-64" side="top">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Pieza {selection.tooth}</p>
                <p className="text-[11px] text-muted-foreground">
                  {toothCommonName(selection.tooth) ? `${toothCommonName(selection.tooth)} · ` : ""}
                  {SURFACE_LABELS[selection.surface]}
                </p>
              </div>
              <button
                onClick={() => setSelection(null)}
                aria-label="Cerrar"
                className="rounded p-1 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-3.5" />
              </button>
            </div>
            {!puedeEditar ? (
              <p className="text-[11px] text-muted-foreground">
                Tu rol no puede modificar el odontograma.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {availableConditions.map((cond) => (
                  <button
                    key={cond}
                    onClick={() => marcar(cond)}
                    disabled={save.enCurso}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border border-hairline px-2 py-1.5 text-[11px] font-medium transition-colors hover:bg-secondary/60 disabled:opacity-50",
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-3 rounded-sm border border-hairline"
                      style={{ backgroundColor: CONDITION_COLORS[cond] }}
                    />
                    {CONDITION_LABELS[cond]}
                  </button>
                ))}
                {save.enCurso && (
                  <span className="col-span-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Guardando…
                  </span>
                )}
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}

      {showHistory && (
        <div className="mt-6 space-y-1.5 border-t border-hairline pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <RotateCcw className="size-3" /> Historia de marcas
          </p>
          {history.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Sin cambios registrados aún. Al modificar una superficie, la marca anterior queda
              archivada acá.
            </p>
          )}
          {history.map((h) => (
            <div
              key={h.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md border border-hairline px-3 py-2 text-[11px]",
                h.supersededAt && "opacity-60",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3 rounded-sm border border-hairline"
                  style={{ backgroundColor: CONDITION_COLORS[h.condition] }}
                />
                <span className="font-mono">{h.toothNumber}</span>
                {toothCommonName(h.toothNumber) && (
                  <span className="text-muted-foreground">{toothCommonName(h.toothNumber)}</span>
                )}
                <span className="text-muted-foreground">{SURFACE_LABELS[h.surface]}</span>
                <span className="font-medium">{CONDITION_LABELS[h.condition]}</span>
                {h.supersededAt && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    · archivada
                  </span>
                )}
              </div>
              <span className="text-muted-foreground">
                {h.recordedByName ?? "—"} · {new Date(h.recordedAt).toLocaleString("es-CL")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
