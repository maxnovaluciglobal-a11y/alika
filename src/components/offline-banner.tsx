import { WifiOff } from "lucide-react";

import { useConnectivity } from "@/hooks/use-connectivity";

const hora = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });

/**
 * Aviso de que la app perdió contacto con el servidor.
 *
 * El texto tiene que ser exacto sobre qué se puede y qué no: cobrar, agendar,
 * guardar una nota clínica y marcar el odontograma quedan guardados en el
 * equipo y se sincronizan solos (ver despachadores en `offline-sync.ts`),
 * pero el resto (mandar un WhatsApp, armar un presupuesto) sigue necesitando
 * conexión. Prometer de más acá es peor que no avisar nada — alguien daría
 * por hecho algo que no pasó.
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
        <strong>Sin conexión.</strong> Puedes seguir cobrando, agendando, guardando notas clínicas y
        marcando el odontograma: se guarda en este equipo y se sincroniza solo cuando vuelva
        internet. Ves la información
        {lastOnlineAt ? ` de las ${hora.format(lastOnlineAt)}` : " guardada"}, y enviar mensajes o
        crear presupuestos sí necesita conexión.
      </span>
    </div>
  );
}
