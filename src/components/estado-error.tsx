import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Estado de error de una carga. Un error no es "no hay datos": si se muestra
 * como lista vacía, quien usa la pantalla cree que no hay nada (auditoría
 * 07-oct). Reemplaza el estado vacío cuando la query principal falla.
 */
export function ErrorDeCarga({
  onReintentar,
  mensaje = "No pudimos cargar estos datos. Revisa la conexión.",
  className,
}: {
  onReintentar: () => unknown;
  mensaje?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive-border bg-destructive-soft px-4 py-4 text-sm text-destructive",
        className,
      )}
    >
      <span>{mensaje}</span>
      <button
        type="button"
        onClick={() => void onReintentar()}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Reintentar
      </button>
    </div>
  );
}
