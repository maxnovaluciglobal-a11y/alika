import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { sendEmailFromTemplate } from "@/lib/messaging.functions";
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

/** Mismo patrón que WhatsAppButton: renderiza el template en el server,
 * registra el mensaje en el historial compartido (`messages`, channel
 * "email"), y muestra el resultado. A diferencia de WhatsApp no hay link
 * externo que abrir — el envío es directo por Resend. */
export function EmailButton({
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
  const sendFn = useServerFn(sendEmailFromTemplate);

  const send = useMutation({
    mutationFn: () =>
      sendFn({
        data: { clinicId, patientId, templateKind, variables, appointmentId, quoteId },
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["messages", clinicId, patientId] });
      if (result.sent) {
        toast.success("Email enviado.");
        onSent?.();
      } else {
        toast.error(result.reason ?? "No se pudo enviar el email.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleClick = () => {
    setPending(true);
    send.mutate(undefined, { onSettled: () => setPending(false) });
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || send.isPending}
        title={label ?? "Enviar por email"}
        aria-label={label ?? "Enviar por email"}
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-md border border-hairline text-muted-foreground transition-colors hover:border-brand hover:text-brand disabled:opacity-50",
        )}
      >
        {send.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Mail className="size-3.5" />
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
        <Mail className="size-3.5" />
      )}
      {label ?? "Enviar por email"}
    </button>
  );
}
