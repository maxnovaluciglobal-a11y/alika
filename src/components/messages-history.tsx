import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle } from "lucide-react";

import { MESSAGE_STATUS_LABELS, MESSAGE_TEMPLATE_KIND_LABELS } from "@/lib/messaging";
import { listMessages } from "@/lib/messaging.functions";

interface Props {
  clinicId: string;
  patientId: string;
}

/** Historial de mensajes enviados al paciente (WhatsApp, SMS, email). */
export function MessagesHistory({ clinicId, patientId }: Props) {
  const fetchMessages = useServerFn(listMessages);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", clinicId, patientId],
    queryFn: () => fetchMessages({ data: { clinicId, patientId } }),
  });

  return (
    <div className="card-clinical p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">Comunicaciones</h3>
          <p className="text-xs text-muted-foreground">
            Historial de mensajes enviados al paciente.
          </p>
        </div>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Cargando…</p>}

      {!isLoading && messages.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Todavía no se enviaron mensajes al paciente. Desde la agenda o los presupuestos puedes
          disparar recordatorios y envíos por WhatsApp.
        </p>
      )}

      {!isLoading && messages.length > 0 && (
        <div className="space-y-2">
          {messages.map((m) => (
            <div key={m.id} className="rounded-lg border border-hairline p-3">
              <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MessageCircle className="size-3.5 text-brand" />
                  <span className="font-medium uppercase tracking-wide">{m.channel}</span>
                  {m.templateKind && <span>· {MESSAGE_TEMPLATE_KIND_LABELS[m.templateKind]}</span>}
                  <span>· {MESSAGE_STATUS_LABELS[m.status]}</span>
                </div>
                <span>{new Date(m.createdAt).toLocaleString("es-CL")}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/90">{m.body}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">a {m.recipient}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
