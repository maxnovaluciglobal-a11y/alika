import type { MessageChannel, MessageStatus } from "@/lib/messaging/messaging";

export type MessageDirection = "inbound" | "outbound";

/**
 * Un mensaje dentro de un hilo, ya normalizado para pintarlo como burbuja.
 * A diferencia de `Message` (messaging.ts), este SÍ trae `direction` — sin
 * eso un "gracias, ahí voy" del paciente se renderiza igual que un
 * recordatorio que mandó la clínica, que es como estaba hasta ahora.
 */
export interface ConversationMessage {
  id: string;
  direction: MessageDirection;
  channel: MessageChannel;
  status: MessageStatus;
  body: string;
  templateKind: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  error: string | null;
}

export interface ConversationSummary {
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  waOptIn: boolean;
  waOptOutAt: string | null;
  lastMessageAt: string;
  lastMessageBody: string;
  lastMessageDirection: MessageDirection;
  /** Fecha del último mensaje ENTRANTE, o null si el paciente nunca escribió. */
  lastInboundAt: string | null;
  /** Mensajes entrantes seguidos al final del hilo, sin ninguna respuesta después. */
  inboundStreak: number;
}

/**
 * La ventana de servicio de Meta: 24h desde el último mensaje del cliente.
 * Mientras esté abierta, la clínica puede responder texto libre sin plantilla
 * aprobada. Cerrada, la Cloud API solo acepta plantillas — por eso la bandeja
 * necesita mostrar el estado antes de que alguien escriba, no después de que
 * Meta rechace el envío.
 */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ServiceWindow {
  open: boolean;
  /** Minutos que faltan para que cierre. 0 si ya está cerrada o nunca se abrió. */
  minutesLeft: number;
}

export function serviceWindow(
  lastInboundAt: string | null,
  now: number = Date.now(),
): ServiceWindow {
  if (!lastInboundAt) return { open: false, minutesLeft: 0 };
  const abre = new Date(lastInboundAt).getTime();
  if (Number.isNaN(abre)) return { open: false, minutesLeft: 0 };
  const restante = abre + SERVICE_WINDOW_MS - now;
  if (restante <= 0) return { open: false, minutesLeft: 0 };
  return { open: true, minutesLeft: Math.ceil(restante / 60_000) };
}

/** "23 h 10 min", "45 min" — para el cartel de ventana abierta. */
export function formatVentana(minutesLeft: number): string {
  if (minutesLeft <= 0) return "cerrada";
  const h = Math.floor(minutesLeft / 60);
  const m = minutesLeft % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Una conversación está SIN RESPONDER si el último mensaje del hilo lo
 * escribió el paciente.
 *
 * Se eligió este criterio en vez de un flag "leído" a propósito: leer un
 * mensaje y no contestarlo no es haberlo atendido, y un flag de lectura se
 * apaga solo con que alguien abra la pantalla de paso. Además no necesita
 * ninguna columna nueva — el hecho ya está en `messages.direction`, que es
 * lo único que la clínica realmente puede auditar después.
 */
export function sinResponder(c: Pick<ConversationSummary, "lastMessageDirection">): boolean {
  return c.lastMessageDirection === "inbound";
}

/**
 * Agrupa mensajes (ya ordenados de más nuevo a más viejo) en un resumen por
 * paciente. Vive acá y no en la server function para poder testearla sin DB.
 */
export function agruparConversaciones(
  rows: Array<{
    patientId: string;
    direction: MessageDirection;
    body: string;
    createdAt: string;
  }>,
  pacientes: Map<
    string,
    { name: string; phone: string | null; waOptIn: boolean; waOptOutAt: string | null }
  >,
): ConversationSummary[] {
  const porPaciente = new Map<string, ConversationSummary>();
  /** Paciente cuya racha de entrantes ya fue cortada por un saliente. */
  const rachaCerrada = new Set<string>();

  for (const row of rows) {
    const ficha = pacientes.get(row.patientId);
    if (!ficha) continue; // paciente borrado entre las dos queries

    let conv = porPaciente.get(row.patientId);
    if (!conv) {
      // Primera fila de este paciente = su mensaje MÁS NUEVO (rows viene
      // ordenado desc). Fija el estado "último mensaje" de una vez.
      conv = {
        patientId: row.patientId,
        patientName: ficha.name,
        patientPhone: ficha.phone,
        waOptIn: ficha.waOptIn,
        waOptOutAt: ficha.waOptOutAt,
        lastMessageAt: row.createdAt,
        lastMessageBody: row.body,
        lastMessageDirection: row.direction,
        lastInboundAt: null,
        inboundStreak: 0,
      };
      porPaciente.set(row.patientId, conv);
    }

    if (row.direction === "inbound") {
      if (!conv.lastInboundAt) conv.lastInboundAt = row.createdAt;
      if (!rachaCerrada.has(row.patientId)) conv.inboundStreak += 1;
    } else {
      // Yendo hacia atrás, el primer saliente cierra la racha final.
      rachaCerrada.add(row.patientId);
    }
  }

  return [...porPaciente.values()].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}
