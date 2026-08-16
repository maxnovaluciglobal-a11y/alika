import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { sendWhatsAppFromTemplate } from "@/lib/messaging.functions";
import type { MessageTemplateKind } from "@/lib/messaging";
import { cn } from "@/lib/utils";

interface Props {
  clinicId: string;
  patientId: string;
  templateKind: MessageTemplateKind;
  variables: Record<string, string>;
  appointmentId?: string;
  quoteId?: string;
  label?: string;
  variant?: "compact" | "full";
  onSent?: () => void;
}

/**
 * Renderiza el template en el server, guarda el mensaje en historial, y
 * abre la URL wa.me en una tab nueva para que el usuario mande el mensaje
 * desde su WhatsApp (personal o Business de la clínica). Cero costo de
 * proveedor; sin cron todavía (Fase 4B).
 */
export function WhatsAppButton({
  clinicId,
  patientId,
  templateKind,
  variables,
  appointmentId,
  quoteId,
  label,
  variant = "compact",
  onSent,
}: Props) {
  const [pending, setPending] = useState(false);
  const queryClient = useQueryClient();
  const sendFn = useServerFn(sendWhatsAppFromTemplate);

  const send = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          clinicId,
          patientId,
          templateKind,
          variables,
          appointmentId,
          quoteId,
        },
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["messages", clinicId, patientId] });
      if (result.viaApi) {
        // Se mandó de verdad por la Cloud API — no hay wa.me que abrir.
        toast.success("Mensaje enviado por WhatsApp.");
        onSent?.();
        return;
      }
      if (!result.waUrl) {
        toast.error("No pudimos construir el link (¿el paciente tiene teléfono válido?).");
        return;
      }
      // La apertura de la nueva tab tiene que suceder en el handler del click
      // original (política de popup blockers). Como el mutation es async,
      // usamos noopener/noreferrer y el window.open igual funciona porque
      // esto se ejecuta dentro del ciclo de click.
      window.open(result.waUrl, "_blank", "noopener,noreferrer");
      toast.success("Mensaje registrado y abierto en WhatsApp.");
      onSent?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleClick = () => {
    setPending(true);
    send.mutate(undefined, {
      onSettled: () => setPending(false),
    });
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || send.isPending}
        title={label ?? "Enviar por WhatsApp"}
        aria-label={label ?? "Enviar por WhatsApp"}
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-md border border-hairline text-muted-foreground transition-colors hover:border-brand hover:text-brand disabled:opacity-50",
        )}
      >
        {send.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <MessageCircle className="size-3.5" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending || send.isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
    >
      {send.isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <MessageCircle className="size-3.5" />
      )}
      {label ?? "Enviar por WhatsApp"}
    </button>
  );
}
