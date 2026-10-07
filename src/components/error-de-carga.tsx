import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Un error de carga no es "no hay datos" (auditoría 07-oct-2026): si la red
 * se cae, la pantalla lo dice y ofrece reintentar en vez de mostrar el
 * estado vacío. Mismo tratamiento que el error de la agenda de Hoy.
 */
export function ErrorDeCarga({
  mensaje,
  onReintentar,
  reintentando = false,
  className,
}: {
  mensaje: string;
  onReintentar: () => void;
  reintentando?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-y border-destructive-border bg-destructive-soft px-4 py-5 text-sm text-destructive",
        className,
      )}
    >
      <span>{mensaje}</span>
      <button
        type="button"
        onClick={onReintentar}
        disabled={reintentando}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {reintentando ? "Reintentando…" : "Reintentar"}
      </button>
    </div>
  );
}
