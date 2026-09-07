import { UserCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * "El paciente avisó que viene."
 *
 * Va SIEMPRE al lado de la etiqueta de estado, nunca en vez de ella: son dos
 * hechos distintos que la agenda tiene que poder mostrar a la vez. `estado:
 * "confirmada"` es que el profesional aceptó la cita; esto es que el paciente
 * contestó el recordatorio. Una cita puede tener uno, el otro, los dos o
 * ninguno, y colapsarlos en un solo indicador fue lo que obligó a remover la
 * confirmación por WhatsApp en `505eb7d`.
 *
 * Por eso el color es distinto al de los estados y el ícono es una persona.
 */
export function PatientConfirmedBadge({
  compacto = false,
  soloIcono = false,
}: {
  compacto?: boolean;
  /** Sin texto. Para tarjetas de agenda: una cita de 30 min mide 35px de alto
   * y cualquier cosa debajo de la primera línea la recorta el overflow. */
  soloIcono?: boolean;
}) {
  if (soloIcono) {
    return (
      <UserCheck
        className="size-3 shrink-0 text-success"
        aria-label="El paciente avisó que viene"
      />
    );
  }

  return (
    <span
      title="El paciente respondió que viene. No reemplaza la confirmación del profesional."
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded bg-success-soft font-medium text-success",
        compacto ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[10px]",
      )}
    >
      <UserCheck className={compacto ? "size-2.5" : "size-3"} aria-hidden />
      <span>{compacto ? "avisó" : "avisó que viene"}</span>
    </span>
  );
}
