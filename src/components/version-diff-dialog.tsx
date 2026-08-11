import { useMemo, useState } from "react";
import { ArrowRight, GitCompare, X } from "lucide-react";
import { diffLineas, resumenDiff } from "@/lib/note-diff";
import { formatoFechaHora, type ClinicalNoteVersion } from "@/lib/clinical-notes";

interface Props {
  versiones: ClinicalNoteVersion[];
  desde?: number | null;
  hasta?: number | null;
  onClose: () => void;
}

/** Comparador de contenido entre dos versiones de la nota clínica. */
export function VersionDiffDialog({ versiones, desde, hasta, onClose }: Props) {
  const ordenadas = useMemo(
    () => [...versiones].sort((a, b) => a.version - b.version),
    [versiones],
  );
  const ultima = ordenadas[ordenadas.length - 1]?.version ?? 1;
  const penultima = ordenadas[ordenadas.length - 2]?.version ?? ultima;

  const [a, setA] = useState<number>(desde ?? penultima);
  const [b, setB] = useState<number>(hasta ?? ultima);

  const vA = ordenadas.find((v) => v.version === a);
  const vB = ordenadas.find((v) => v.version === b);
  const lineas = useMemo(
    () => diffLineas(vA?.content ?? "", vB?.content ?? ""),
    [vA?.content, vB?.content],
  );
  const conteo = resumenDiff(lineas);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-hairline bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <GitCompare className="size-4 text-brand" /> Comparar versiones
          </p>
          <button onClick={onClose} aria-label="Cerrar" className="rounded p-1 hover:bg-secondary">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-5 py-3 text-xs">
          <select
            value={a}
            onChange={(e) => setA(Number(e.target.value))}
            className="rounded-lg border border-hairline bg-background px-2 py-1.5"
          >
            {ordenadas.map((v) => (
              <option key={v.id} value={v.version}>
                v{v.version} · {formatoFechaHora(v.createdAt)}
              </option>
            ))}
          </select>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <select
            value={b}
            onChange={(e) => setB(Number(e.target.value))}
            className="rounded-lg border border-hairline bg-background px-2 py-1.5"
          >
            {ordenadas.map((v) => (
              <option key={v.id} value={v.version}>
                v{v.version} · {formatoFechaHora(v.createdAt)}
              </option>
            ))}
          </select>
          <span className="ml-auto text-[11px] text-muted-foreground">
            <span className="text-brand">+{conteo.agregadas}</span> ·{" "}
            <span className="text-destructive">−{conteo.eliminadas}</span> líneas
          </span>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {conteo.agregadas === 0 && conteo.eliminadas === 0 ? (
            <p className="text-xs text-muted-foreground">
              No hay diferencias de contenido entre estas dos versiones.
            </p>
          ) : (
            <div className="space-y-0.5 font-mono text-[11px] leading-relaxed">
              {lineas.map((l, i) => (
                <div
                  key={i}
                  className={`whitespace-pre-wrap rounded px-2 py-0.5 ${
                    l.kind === "added"
                      ? "bg-brand-soft text-foreground"
                      : l.kind === "removed"
                        ? "bg-destructive/10 text-muted-foreground line-through"
                        : "text-muted-foreground"
                  }`}
                >
                  <span className="mr-2 select-none opacity-60">
                    {l.kind === "added" ? "+" : l.kind === "removed" ? "−" : " "}
                  </span>
                  {l.text || " "}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-hairline px-5 py-3 text-[10px] text-muted-foreground">
          Comparación de contenido clínico. Las versiones son inmutables y quedan registradas en la
          auditoría.
        </div>
      </div>
    </div>
  );
}
