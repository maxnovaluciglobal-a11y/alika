import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { setPatientWhatsAppOptIn } from "@/lib/messaging.functions";
import { cn } from "@/lib/utils";

interface Props {
  clinicId: string;
  patientId: string;
  initialOptIn: boolean;
}

/**
 * Consentimiento para outreach proactivo (recall/reseña/saldo) — NO gatea los
 * recordatorios de cita, que son transaccionales a un turno que el paciente
 * ya reservó. Apagarlo es inmediato para cualquier operador; prenderlo
 * asume que ya se habló con el paciente (no hay doble confirmación acá,
 * como sí la hay del lado del paciente cuando responde BAJA por WhatsApp).
 */
export function WhatsAppOptInToggle({ clinicId, patientId, initialOptIn }: Props) {
  const [optIn, setOptIn] = useState(initialOptIn);
  const setOptInFn = useServerFn(setPatientWhatsAppOptIn);

  const mut = useMutation({
    mutationFn: (next: boolean) => setOptInFn({ data: { clinicId, patientId, optIn: next } }),
    onSuccess: (_data, next) => {
      setOptIn(next);
      toast.success(
        next ? "Outreach por WhatsApp activado." : "Outreach por WhatsApp desactivado.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <button
        type="button"
        role="switch"
        aria-checked={optIn}
        aria-label="Outreach proactivo por WhatsApp (recall, reseña, saldo)"
        disabled={mut.isPending}
        onClick={() => mut.mutate(!optIn)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border border-border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50",
          optIn ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3.5 rounded-full bg-background shadow transition-all",
            optIn ? "left-[1.15rem]" : "left-0.5",
          )}
        />
      </button>
      <span>
        {mut.isPending ? (
          <Loader2 className="inline size-3 animate-spin" />
        ) : optIn ? (
          "Acepta recall, reseña y avisos de saldo por WhatsApp"
        ) : (
          "Sin consentimiento para outreach proactivo"
        )}
      </span>
    </div>
  );
}
