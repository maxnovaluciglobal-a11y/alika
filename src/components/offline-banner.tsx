import { WifiOff } from "lucide-react";

import { useConnectivity } from "@/hooks/use-connectivity";

const hora = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });

/**
 * Aviso de que la app perdió contacto con el servidor.
 *
 * Dice explícitamente que NO se puede guardar: hoy la app deja consultar
 * offline pero todavía no encola escrituras (eso llega con la cola de
 * sincronización). Callarlo haría que alguien cargue un pago creyendo que
 * quedó guardado. Cuando exista la cola, este texto cambia.
 */
export function OfflineBanner() {
  const { online, lastOnlineAt } = useConnectivity();

  if (online) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-warning/30 bg-warning-soft px-5 py-2 text-sm text-warning sm:px-8"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>
        <strong>Sin conexión.</strong> Puedes seguir consultando la información
        {lastOnlineAt ? ` guardada a las ${hora.format(lastOnlineAt)}` : " guardada"}, pero los
        cambios no se guardan hasta que vuelva internet.
      </span>
    </div>
  );
}
