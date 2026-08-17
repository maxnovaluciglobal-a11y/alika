import { AlertTriangle, CloudUpload } from "lucide-react";

import { useColaOffline } from "@/hooks/use-offline-mutation";
import { descartarFallido } from "@/lib/offline-queue";

const hora = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });

/**
 * Trabajo capturado que todavía no llegó al servidor.
 *
 * Son dos avisos distintos a propósito:
 *
 * - **Pendientes**: informativo. Se sincronizan solos, el equipo no tiene que
 *   hacer nada; sirve para que nadie se vaya de la clínica creyendo que todo
 *   está guardado cuando falta subir cobros.
 * - **Fallidos**: el servidor los rechazó por algo que reintentar no arregla.
 *   Requieren que una persona los mire. Un cobro que se pierde en silencio es
 *   peor que uno que nunca se registró, así que esto NO se auto-descarta.
 */
export function PendingSyncBanner({ userId }: { userId: string | undefined }) {
  const { pendientes, fallidos } = useColaOffline(userId);

  if (pendientes.length === 0 && fallidos.length === 0) return null;

  return (
    <>
      {pendientes.length > 0 && (
        <div
          role="status"
          className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-2 text-sm sm:px-8"
        >
          <CloudUpload className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            {pendientes.length === 1
              ? "1 operación guardada en este equipo"
              : `${pendientes.length} operaciones guardadas en este equipo`}
            , esperando internet para sincronizar.
          </span>
        </div>
      )}

      {fallidos.length > 0 && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-5 py-2 text-sm sm:px-8">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            <span>
              {fallidos.length === 1
                ? "1 operación no se pudo guardar y necesita tu revisión."
                : `${fallidos.length} operaciones no se pudieron guardar y necesitan tu revisión.`}
            </span>
          </div>
          <ul className="mt-1.5 space-y-1 pl-6">
            {fallidos.map((item) => (
              <li key={item.localId} className="flex flex-wrap items-center gap-x-2 text-xs">
                <span className="font-medium">{item.resumen}</span>
                <span className="text-muted-foreground">
                  ({hora.format(new Date(item.capturedAt))}) — {item.error}
                </span>
                <button
                  type="button"
                  onClick={() => void descartarFallido(item.localId)}
                  className="underline underline-offset-2 hover:no-underline"
                >
                  Descartar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
