import { claseTexto, type TonoEstado } from "@/lib/clinic-operations/estado-cita-tono";
import { cn } from "@/lib/utils";

/**
 * Fila de cifras entre filetes, la misma forma que `FilaKpis` de Hoy
 * (dashboard.tsx) para las pantallas que se migraron después (Finanzas,
 * Caja). `tono` colorea la cifra y `tonoNota` la nota solo cuando hay algo
 * que mirar; el texto de la nota siempre dice lo mismo que el color.
 */
export type KpiFilete = {
  label: string;
  valor: string;
  nota: string;
  tono?: TonoEstado;
  tonoNota?: TonoEstado;
};

export function KpisEnFilete({
  kpis,
  cargando = false,
  columnas = 4,
  tamano = "lg",
}: {
  kpis: KpiFilete[];
  cargando?: boolean;
  /** 4 = dos por fila en celular y cuatro desde md (como Hoy); 2 = siempre dos. */
  columnas?: 2 | 4;
  tamano?: "lg" | "md";
}) {
  return (
    <dl
      className={cn("grid grid-cols-2 border-y border-border", columnas === 4 && "md:grid-cols-4")}
    >
      {kpis.map((k, i) => (
        <div
          key={k.label}
          className={cn(
            "min-w-0 py-5 pr-5 pl-5",
            i % 2 === 0 && "pl-0",
            i % 2 === 1 && "border-l border-hairline",
            i >= 2 && "border-t border-hairline",
            columnas === 4 && [i >= 2 && "md:border-t-0", i === 2 && "md:border-l md:pl-5"],
          )}
        >
          <dt className="kicker">{k.label}</dt>
          <dd
            className={cn(
              // Un monto no se corta nunca ("$2.516…" no dice cuánto). En
              // celular el tamaño baja con el ancho de la pantalla para que
              // "-$2.169.836" entre en media columna; desde sm vuelve al fijo.
              "mt-2 whitespace-nowrap font-display font-normal leading-none tabular-nums",
              tamano === "lg"
                ? "text-[clamp(1.375rem,6.4vw,1.875rem)] sm:text-4xl"
                : "text-[clamp(1.25rem,5.6vw,1.5rem)] sm:text-3xl",
              k.tono && claseTexto[k.tono],
            )}
          >
            {cargando ? (
              <span
                className={cn(
                  "inline-block w-20 animate-pulse rounded-sm bg-muted",
                  tamano === "lg" ? "h-9" : "h-7",
                )}
                aria-label="Cargando"
              />
            ) : (
              k.valor
            )}
          </dd>
          <dd
            className={cn(
              "mt-1.5 text-sm",
              k.tonoNota ? claseTexto[k.tonoNota] : "text-muted-foreground",
            )}
          >
            {cargando ? "\u00a0" : k.nota}
          </dd>
        </div>
      ))}
    </dl>
  );
}
