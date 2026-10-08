import { Check, CheckCheck, Circle, Clock, X, type LucideIcon } from "lucide-react";

import type { Cita } from "@/lib/clinic-operations/clinic-data";
import {
  estiloDeCita,
  textoEstadoCita,
  type IconoEstado,
} from "@/lib/clinic-operations/estado-cita-tono";
import { cn } from "@/lib/utils";

const ICONO: Record<IconoEstado, LucideIcon> = {
  reloj: Clock,
  check: Check,
  punto: Circle,
  "doble-check": CheckCheck,
  cruz: X,
};

/**
 * Pastilla de estado de cita: forma + ícono + color + texto (dirección
 * híbrida, 08-oct-2026). El ícono es decorativo (`aria-hidden`); el texto
 * siempre está visible y es lo que lee el lector de pantalla.
 */
export function EstadoCitaPastilla({
  cita,
  className,
}: {
  cita: Pick<Cita, "estado" | "pacienteConfirmo">;
  className?: string;
}) {
  const estilo = estiloDeCita(cita);
  const Icono = ICONO[estilo.icono];
  return (
    <span
      data-forma={estilo.forma}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-px text-xs leading-[17px]",
        estilo.clase,
        className,
      )}
    >
      <Icono
        aria-hidden
        strokeWidth={2.4}
        className={cn("size-3 shrink-0", estilo.icono === "punto" && "size-2 fill-current")}
      />
      {textoEstadoCita(cita)}
    </span>
  );
}
