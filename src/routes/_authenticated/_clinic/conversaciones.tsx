import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  BellOff,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  Inbox,
  Loader2,
  Send,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { requirePermission } from "@/lib/access/route-guards";
import { MESSAGE_TEMPLATE_KIND_LABELS, type MessageTemplateKind } from "@/lib/messaging/messaging";
import {
  formatVentana,
  sinResponder,
  type ConversationMessage,
  type ConversationSummary,
} from "@/lib/messaging/conversations";
import { tiempoRelativo } from "@/lib/messaging/notifications";
import {
  listConversationThread,
  listConversations,
  replyToConversation,
} from "@/lib/messaging/conversations.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_clinic/conversaciones")({
  beforeLoad: requirePermission("agenda:manage"),
  validateSearch: (search: Record<string, unknown>) => ({
    paciente: typeof search.paciente === "string" ? search.paciente : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Conversaciones | Alika" },
      {
        name: "description",
        content:
          "Todos los mensajes de WhatsApp con tus pacientes en un solo hilo, con lo que quedó sin responder arriba.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConversacionesPage,
});

function ConversacionesPage() {
  const { access } = Route.useRouteContext();
  const { paciente: pacienteSeleccionado } = Route.useSearch();
  const navigate = Route.useNavigate();
  const clinicId = access.clinic?.id;
  const [soloSinResponder, setSoloSinResponder] = useState(false);

  const fetchConversations = useServerFn(listConversations);
  const { data, isLoading } = useQuery({
    queryKey: ["conversations", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchConversations({ data: { clinicId: clinicId! } }),
    refetchInterval: 2 * 60_000,
  });

  const conversaciones = useMemo(() => data?.conversations ?? [], [data]);
  const pendientes = conversaciones.filter(sinResponder).length;
  const visibles = soloSinResponder ? conversaciones.filter(sinResponder) : conversaciones;

  function seleccionar(patientId: string | undefined) {
    void navigate({ search: { paciente: patientId }, replace: true });
  }

  return (
    <AppShell title="Conversaciones" access={access}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Todo lo que tus pacientes escribieron por WhatsApp, en un hilo por persona. Una
            conversación queda marcada <strong>sin responder</strong> cuando el último mensaje lo
            escribió el paciente.
          </p>
          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-hairline p-1">
            <FiltroBoton activo={!soloSinResponder} onClick={() => setSoloSinResponder(false)}>
              Todas ({conversaciones.length})
            </FiltroBoton>
            <FiltroBoton activo={soloSinResponder} onClick={() => setSoloSinResponder(true)}>
              Sin responder ({pendientes})
            </FiltroBoton>
          </div>
        </div>

        {data?.truncated && (
          <p className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-xs text-warning">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span>
              Se están mostrando los 1.000 mensajes más recientes de la clínica. Las conversaciones
              más viejas siguen completas en la ficha de cada paciente.
            </span>
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className={cn("min-w-0", pacienteSeleccionado && "hidden lg:block")}>
            <ListaConversaciones
              conversaciones={visibles}
              cargando={isLoading}
              seleccionado={pacienteSeleccionado}
              onSeleccionar={seleccionar}
              vacioPorFiltro={soloSinResponder && conversaciones.length > 0}
            />
          </div>

          <div className={cn("min-w-0", !pacienteSeleccionado && "hidden lg:block")}>
            {pacienteSeleccionado && clinicId ? (
              <Hilo
                clinicId={clinicId}
                patientId={pacienteSeleccionado}
                onVolver={() => seleccionar(undefined)}
              />
            ) : (
              <div className="card-clinical flex h-full min-h-[24rem] flex-col items-center justify-center gap-2 p-8 text-center">
                <Inbox className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Elegí una conversación de la lista para leerla y responder.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function FiltroBoton({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        activo ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function ListaConversaciones({
  conversaciones,
  cargando,
  seleccionado,
  onSeleccionar,
  vacioPorFiltro,
}: {
  conversaciones: ConversationSummary[];
  cargando: boolean;
  seleccionado: string | undefined;
  onSeleccionar: (id: string) => void;
  vacioPorFiltro: boolean;
}) {
  if (cargando) {
    return <div className="card-clinical p-6 text-sm text-muted-foreground">Cargando…</div>;
  }

  if (conversaciones.length === 0) {
    return (
      <div className="card-clinical space-y-2 p-6">
        <p className="text-sm font-medium">
          {vacioPorFiltro ? "No queda nada sin responder." : "Todavía no hay conversaciones."}
        </p>
        <p className="text-xs text-muted-foreground">
          {vacioPorFiltro
            ? "Todos los hilos terminan con un mensaje de la clínica."
            : "Acá van a aparecer los mensajes que te escriban los pacientes por WhatsApp, y los que la clínica les mande."}
        </p>
      </div>
    );
  }

  return (
    <ul className="card-clinical divide-y divide-hairline overflow-hidden p-0">
      {conversaciones.map((c) => {
        const pendiente = sinResponder(c);
        return (
          <li key={c.patientId}>
            <button
              type="button"
              onClick={() => onSeleccionar(c.patientId)}
              aria-current={seleccionado === c.patientId ? "true" : undefined}
              className={cn(
                "flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/60",
                seleccionado === c.patientId && "bg-brand-soft/60",
              )}
            >
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  pendiente ? "bg-brand" : "bg-transparent",
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn("truncate text-sm", pendiente ? "font-semibold" : "font-medium")}
                  >
                    {c.patientName}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {tiempoRelativo(c.lastMessageAt)}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {c.lastMessageDirection === "outbound" && (
                    <Check className="size-3 shrink-0" aria-label="Último mensaje de la clínica" />
                  )}
                  <span className="truncate">{c.lastMessageBody}</span>
                </span>
                {pendiente && c.inboundStreak > 1 && (
                  <span className="mt-1 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">
                    {c.inboundStreak} mensajes sin responder
                  </span>
                )}
                {!c.waOptIn && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-destructive">
                    <BellOff className="size-3" /> pidió baja
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Hilo({
  clinicId,
  patientId,
  onVolver,
}: {
  clinicId: string;
  patientId: string;
  onVolver: () => void;
}) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState("");
  const finRef = useRef<HTMLDivElement>(null);

  const fetchThread = useServerFn(listConversationThread);
  const { data: hilo, isLoading } = useQuery({
    queryKey: ["conversation-thread", clinicId, patientId],
    queryFn: () => fetchThread({ data: { clinicId, patientId } }),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [hilo?.messages.length]);

  const responder = useServerFn(replyToConversation);
  const mutation = useMutation({
    mutationFn: (body: string) => responder({ data: { clinicId, patientId, body } }),
    onSuccess: (res) => {
      setTexto("");
      if (res.via === "api") {
        toast.success("Respuesta enviada por WhatsApp.");
      } else if (res.waMeUrl) {
        window.open(res.waMeUrl, "_blank", "noopener,noreferrer");
        toast.success("Se abrió WhatsApp con el mensaje listo para enviar.");
      }
      void queryClient.invalidateQueries({
        queryKey: ["conversation-thread", clinicId, patientId],
      });
      void queryClient.invalidateQueries({ queryKey: ["conversations", clinicId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations-pendientes", clinicId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !hilo) {
    return <div className="card-clinical p-6 text-sm text-muted-foreground">Cargando hilo…</div>;
  }

  const ventanaAbierta = hilo.ventanaMinutos > 0;
  const enviaPorApi = ventanaAbierta && hilo.apiConectada;

  return (
    <div className="card-clinical flex h-full flex-col p-0">
      <header className="flex items-center gap-3 border-b border-hairline p-3">
        <button
          type="button"
          onClick={onVolver}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
          aria-label="Volver a la lista"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{hilo.patientName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {hilo.patientPhone ?? "sin teléfono en la ficha"}
          </p>
        </div>
        <Link
          to="/pacientes/$pacienteId"
          params={{ pacienteId: patientId }}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          <User className="size-3.5" /> Ficha
        </Link>
      </header>

      {!hilo.waOptIn && (
        <p className="flex items-start gap-2 border-b border-hairline bg-destructive/10 p-3 text-xs text-destructive">
          <BellOff className="mt-px size-3.5 shrink-0" />
          <span>
            Este paciente pidió la baja
            {hilo.waOptOutAt && ` el ${new Date(hilo.waOptOutAt).toLocaleDateString("es-CL")}`}. No
            recibe recordatorios automáticos. Responder a mano a algo que él mismo escribió está
            bien; volver a incluirlo en envíos masivos, no.
          </span>
        </p>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: "26rem" }}>
        {hilo.messages.length === 0 && (
          <p className="text-xs text-muted-foreground">No hay mensajes en este hilo.</p>
        )}
        {hilo.messages.map((m) => (
          <Burbuja key={m.id} mensaje={m} />
        ))}
        <div ref={finRef} />
      </div>

      <footer className="space-y-2 border-t border-hairline p-3">
        <p
          className={cn(
            "flex items-center gap-1.5 text-[11px]",
            enviaPorApi ? "text-success" : "text-muted-foreground",
          )}
        >
          <Clock className="size-3" />
          {enviaPorApi ? (
            <>
              Ventana de respuesta abierta ({formatVentana(hilo.ventanaMinutos)}). Se envía directo,
              sin salir de Alika.
            </>
          ) : ventanaAbierta ? (
            <>
              Ventana abierta ({formatVentana(hilo.ventanaMinutos)}), pero todavía no hay un número
              conectado a la API — se abre WhatsApp con el texto listo.
            </>
          ) : (
            <>
              Pasaron más de 24h desde el último mensaje del paciente: WhatsApp no deja responder
              texto libre por la API. Se abre WhatsApp con el texto listo.
            </>
          )}
        </p>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const limpio = texto.trim();
            if (!limpio || mutation.isPending) return;
            mutation.mutate(limpio);
          }}
        >
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            maxLength={4096}
            placeholder="Escribí tu respuesta…"
            aria-label="Respuesta al paciente"
            className="min-h-[2.75rem] flex-1 resize-y rounded-lg border border-hairline bg-background p-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
          <button
            type="submit"
            disabled={!texto.trim() || mutation.isPending}
            className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground disabled:opacity-50"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : enviaPorApi ? (
              <Send className="size-4" />
            ) : (
              <ExternalLink className="size-4" />
            )}
            {enviaPorApi ? "Enviar" : "Abrir WhatsApp"}
          </button>
        </form>
      </footer>
    </div>
  );
}

function Burbuja({ mensaje: m }: { mensaje: ConversationMessage }) {
  const entrante = m.direction === "inbound";
  const etiqueta =
    m.templateKind && m.templateKind in MESSAGE_TEMPLATE_KIND_LABELS
      ? MESSAGE_TEMPLATE_KIND_LABELS[m.templateKind as MessageTemplateKind]
      : null;

  return (
    <div className={cn("flex", entrante ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2",
          entrante
            ? "rounded-bl-sm bg-muted text-foreground"
            : "rounded-br-sm bg-brand-soft text-foreground",
        )}
      >
        {etiqueta && (
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {etiqueta}
          </p>
        )}
        <p className="whitespace-pre-wrap text-sm">{m.body}</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          {new Date(m.createdAt).toLocaleString("es-CL", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {!entrante && m.status === "read" && <CheckCheck className="size-3 text-brand" />}
          {!entrante && m.status === "delivered" && <CheckCheck className="size-3" />}
          {!entrante && m.status === "sent" && <Check className="size-3" />}
          {!entrante && m.status === "failed" && (
            <AlertTriangle className="size-3 text-destructive" />
          )}
        </p>
        {m.error && <p className="mt-1 text-[10px] text-destructive">{m.error}</p>}
      </div>
    </div>
  );
}
