import { useId, useState } from "react";
import { WifiOff } from "lucide-react";

import { useConnectivity } from "@/hooks/use-connectivity";

const hora = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });

/**
 * Aviso de que la app perdió contacto con el servidor.
 *
 * El texto tiene que ser exacto sobre qué se puede y qué no: cobrar, agendar,
 * guardar una nota clínica, marcar el odontograma y editar la anamnesis
 * (alergias, medicación, antecedentes) quedan guardados en el equipo y se
 * sincronizan solos (ver despachadores en `offline-sync.ts`), pero el resto
 * (mandar un WhatsApp, armar un presupuesto) sigue necesitando conexión.
 * Prometer de más acá es peor que no avisar nada — alguien daría por hecho
 * algo que no pasó.
 *
 * A 390px el texto completo ocupaba unas seis líneas encima de cada
 * pantalla. Ahora va una línea corta y el detalle exacto detrás de "Más".
 */
export function OfflineBanner() {
  const { online, lastOnlineAt } = useConnectivity();
  const [abierto, setAbierto] = useState(false);
  const detalleId = useId();

  if (online) return null;

  return (
    <div
      role="status"
      className="border-b border-warning-border bg-warning-soft px-5 py-2 text-sm text-warning sm:px-8"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <strong>Sin conexión:</strong> lo que hagas se guarda y se envía al volver.
        </span>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls={detalleId}
          className="-my-2 shrink-0 px-2 py-2 font-medium underline underline-offset-2 hover:no-underline"
        >
          {abierto ? "Menos" : "Más"}
        </button>
      </div>
      {abierto && (
        <p id={detalleId} className="mt-1 pl-6 text-xs">
          Puedes seguir cobrando, agendando, guardando notas clínicas, marcando el odontograma y
          editando la anamnesis (alergias, medicación, antecedentes): se guarda en este equipo y se
          sincroniza solo cuando vuelva internet. Ves la información
          {lastOnlineAt ? ` de las ${hora.format(lastOnlineAt)}` : " guardada"}. Enviar mensajes o
          crear presupuestos sí necesita conexión.
        </p>
      )}
    </div>
  );
}
