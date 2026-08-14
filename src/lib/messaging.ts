export const MESSAGE_CHANNELS = ["whatsapp", "sms", "email"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const MESSAGE_STATUSES = ["draft", "queued", "sent", "delivered", "read", "failed"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  draft: "Borrador",
  queued: "En cola",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "Falló",
};

export const MESSAGE_TEMPLATE_KINDS = [
  "appointment_reminder",
  "appointment_confirmation",
  "quote_sent",
  "payment_receipt",
  "nps_survey",
  "custom",
] as const;
export type MessageTemplateKind = (typeof MESSAGE_TEMPLATE_KINDS)[number];

export const MESSAGE_TEMPLATE_KIND_LABELS: Record<MessageTemplateKind, string> = {
  appointment_reminder: "Recordatorio de cita",
  appointment_confirmation: "Confirmación de cita",
  quote_sent: "Envío de presupuesto",
  payment_receipt: "Recibo de pago",
  nps_survey: "Encuesta NPS",
  custom: "Personalizado",
};

export interface MessageTemplate {
  id: string;
  kind: MessageTemplateKind;
  name: string;
  channel: MessageChannel;
  body: string;
  isActive: boolean;
}

export interface Message {
  id: string;
  appointmentId: string | null;
  quoteId: string | null;
  templateId: string | null;
  templateKind: MessageTemplateKind | null;
  channel: MessageChannel;
  status: MessageStatus;
  recipient: string;
  body: string;
  sentAt: string | null;
  createdAt: string;
}

/**
 * Renderiza un template sustituyendo `{variable}` por su valor.
 * Variables desconocidas se dejan como estaban — no rompen el envío ni
 * fingen un valor vacío que un humano no note.
 *
 * Nota: el caller es responsable del orden de las keys si hay reservadas
 * como `paciente` — hacer `{ ...vars, paciente: nombreReal }` (paciente al
 * final) para evitar que un cliente malicioso lo sobreescriba.
 */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (match, key) => {
    const v = vars[key as keyof typeof vars];
    return v == null ? match : String(v);
  });
}

/**
 * Convierte un teléfono a formato E.164 apto para wa.me — solo dígitos, sin
 * signo + ni espacios. Chile por defecto (asume 56 si el número parece local).
 * Devuelve null si el input está vacío o no tiene suficientes dígitos.
 */
export function normalizeToWaMe(phone: string, defaultCountryCode = "56"): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  // Si arranca con 0 (formato local con 0), lo saca
  const trimmed = digits.replace(/^0+/, "");
  if (trimmed.length < 8) return null;
  // Si ya arranca con código de país conocido (55/56/57/54/51/52) lo respeta
  const hasCountry = /^(?:5[0-9]|1|4[0-9]|3[0-9])/.test(trimmed);
  return hasCountry && trimmed.length >= 10 ? trimmed : `${defaultCountryCode}${trimmed}`;
}

/** Construye la URL de wa.me con el mensaje encoded. */
export function buildWaMeUrl(phone: string, message: string): string | null {
  const normalized = normalizeToWaMe(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
