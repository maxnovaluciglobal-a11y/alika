import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserCheck, UserRoundX } from "lucide-react";
import { toast } from "sonner";

import { setPatientConfirmation } from "@/lib/clinic-operations/appointments.functions";
import { cn } from "@/lib/utils";

/**
 * Anota a mano que el paciente avisó que viene (llamó, o lo dijo en el
 * mostrador). Deliberadamente separado del menú de estado: ese menú mueve la
 * cita entre estados del PROFESIONAL, esto no cambia el estado de nada.
 */
export function PatientConfirmedToggle({
  clinicId,
  appointmentId,
  confirmado,
}: {
  clinicId: string;
  appointmentId: string;
  confirmado: boolean;
}) {
  const queryClient = useQueryClient();
  const marcar = useServerFn(setPatientConfirmation);

  const mutation = useMutation({
    mutationFn: () => marcar({ data: { appointmentId, confirmado: !confirmado, via: "telefono" } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appointments", clinicId] });
      toast.success(
        confirmado ? "Se quitó el aviso del paciente." : "Anotado: el paciente avisó que viene.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <button
      type="button"
      disabled={mutation.isPending}
      title={
        confirmado
          ? "El paciente avisó que viene. Click para quitar el aviso."
          : "Anotar que el paciente avisó que viene (no confirma la cita)."
      }
      aria-pressed={confirmado}
      aria-label={confirmado ? "Quitar aviso del paciente" : "Anotar aviso del paciente"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        mutation.mutate();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        "shrink-0 rounded p-1 transition-colors disabled:opacity-50",
        confirmado
          ? "bg-success-soft text-success"
          : "text-muted-foreground/60 hover:bg-secondary hover:text-foreground",
      )}
    >
      {confirmado ? <UserCheck className="size-3.5" /> : <UserRoundX className="size-3.5" />}
    </button>
  );
}
