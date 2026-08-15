import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

/**
 * Banner fijo en la clínica demo pública: de solo lectura (bloqueo por
 * trigger, ver migración 20260815180000). Recuerda al visitante que
 * cualquier intento de guardar va a fallar a propósito.
 */
export function DemoBanner() {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-clay/40 bg-clay-soft px-5 py-2 text-sm sm:px-8">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-clay-foreground" />
        <span>
          Estás viendo la <strong>clínica demo</strong> — de solo lectura, los cambios no se
          guardan.
        </span>
      </div>
      <Link
        to="/"
        className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
      >
        Crear mi clínica
      </Link>
    </div>
  );
}
