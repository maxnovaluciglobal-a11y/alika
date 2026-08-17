import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Info, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import { useOfflineMutation } from "@/hooks/use-offline-mutation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CONDITION_COLORS,
  CONDITION_LABELS,
  FDI_LOWER_LEFT,
  FDI_LOWER_RIGHT,
  FDI_UPPER_LEFT,
  FDI_UPPER_RIGHT,
  SURFACE_LABELS,
  TOOTH_CONDITIONS,
  WHOLE_TOOTH_CONDITIONS,
  marksByTooth,
  type OdontogramMark,
  type ToothCondition,
  type ToothSurface,
} from "@/lib/odontogram";
import {
  listOdontogramHistory,
  listOdontogramMarks,
  setOdontogramMark,
} from "@/lib/odontogram.functions";
import { cn } from "@/lib/utils";

const TOOTH_SIZE = 40;
const TOOTH_GAP = 4;

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

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-[10px] text-muted-foreground">{tooth}</span>
      <svg
        width={s}
        height={s}
        viewBox={`0 0 ${s} ${s}`}
        className="cursor-pointer rounded-sm border border-hairline transition-colors hover:border-brand"
        role="img"
        aria-label={`Pieza ${tooth}`}
      >
        {wholeColor && (
          <rect
            x={0}
            y={0}
            width={s}
            height={s}
            fill={wholeColor}
            opacity={0.85}
            onClick={() => onClick({ tooth, surface: "whole" })}
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
              onClick={(e) => {
                e.stopPropagation();
                onClick({ tooth, surface: z.surface });
              }}
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
            onClick={(e) => {
              e.stopPropagation();
              onClick({ tooth, surface: "oclusal" });
            }}
          />
        )}
        {/* Zona invisible para marcar "whole" cuando aún no hay override — click en borde superior */}
        {!wholeColor && (
          <rect
            x={0}
            y={-6}
            width={s}
            height={6}
            fill="transparent"
            onClick={() => onClick({ tooth, surface: "whole" })}
          />
        )}
      </svg>
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
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium hover:bg-secondary/60"
        >
          <History className="size-3" /> {showHistory ? "Ocultar historia" : "Ver historia"}
        </button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Cargando odontograma…</p>}

      {!isLoading && (
        <div className="space-y-4 overflow-x-auto">
          <div className="flex flex-col items-center gap-3">
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
          </div>

          <p className="flex items-center gap-1.5 pt-2 text-[11px] text-muted-foreground">
            <Info className="size-3" /> Arriba: piezas 18→11 · 21→28. Abajo: 48→41 · 31→38.
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
