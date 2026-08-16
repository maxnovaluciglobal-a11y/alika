import type { OutreachTemplateKind } from "@/lib/messaging";

/**
 * Estado del número conectado. `connected` es el único que puede enviar.
 * `disabled` = el owner lo desconectó a mano. `flagged` = Meta bajó el
 * quality_rating a algo que ameritaría revisión (hoy informativo, no bloquea
 * envío — eso lo decide Meta mismo devolviendo error en el POST).
 */
export const WHATSAPP_ACCOUNT_STATUSES = ["connected", "disabled", "flagged"] as const;
export type WhatsAppAccountStatus = (typeof WHATSAPP_ACCOUNT_STATUSES)[number];

export interface WhatsAppAccount {
  id: string;
  clinicId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhone: string | null;
  status: WhatsAppAccountStatus;
  qualityRating: string | null;
  connectedAt: string;
}

/**
 * Variables por kind, en el ORDEN posicional {{1}} {{2}} ... que va a tener
 * la plantilla una vez registrada en Meta. Este orden es un contrato con el
 * texto que se registre en Meta Business Manager — si se registra distinto,
 * hay que actualizar esto para que coincida (no hay forma de que Meta lo
 * valide por nosotros).
 *
 * Los kinds que no están acá (appointment_confirmation, quote_sent,
 * payment_receipt, nps_survey, custom) siguen siendo wa.me-only por ahora:
 * no forman parte del alcance de Fase 1.
 */
export const META_TEMPLATE_PARAM_ORDER: Record<
  | "appointment_reminder"
  | "appointment_checkin"
  | "waitlist_opening"
  | "portal_invite"
  | OutreachTemplateKind,
  readonly string[]
> = {
  appointment_reminder: ["paciente", "tratamiento", "fecha_larga", "hora", "clinica"],
  appointment_checkin: ["paciente", "tratamiento", "hora", "clinica"],
  hygiene_recall: ["paciente", "meses", "clinica"],
  // Sin link_resena / link_pago: no existe infraestructura para ninguno de
  // los dos todavía (no hay campo de Google Reviews por clínica; el billing
  // de Stripe es solo un skeleton, no genera links de cobro a pacientes).
  // Ver migración 20260816140000 — se corrigió el texto en vez de mandar un
  // {{n}} vacío o un placeholder falso a un paciente real.
  review_request: ["paciente", "clinica"],
  payment_due: ["paciente", "saldo", "clinica"],
  // Fase 2
  waitlist_opening: ["paciente", "motivo", "clinica"],
  quote_follow_up: ["paciente", "numero_presupuesto", "total", "clinica"],
  // El link va último — mismo criterio que saldo/monto en Fase 1, el valor
  // más largo/dinámico al final de la lista de parámetros.
  portal_invite: ["paciente", "dias", "clinica", "link"],
};

/**
 * Arma el array de parámetros posicionales que espera la Cloud API
 * (`components[0].parameters`) a partir de las variables con nombre que ya
 * usa el resto del código (`renderTemplate`). Si falta una variable para el
 * kind, tira — mandar una plantilla con un {{n}} vacío la rechaza Meta igual,
 * mejor fallar acá con un mensaje legible.
 */
export function buildMetaTemplateParams(
  kind: keyof typeof META_TEMPLATE_PARAM_ORDER,
  vars: Record<string, string>,
): string[] {
  const order = META_TEMPLATE_PARAM_ORDER[kind];
  return order.map((key) => {
    const v = vars[key];
    if (v == null || v === "") {
      throw new Error(`Falta la variable "${key}" para la plantilla ${kind}.`);
    }
    return v;
  });
}

/** ¿Este kind tiene envío por API en Fase 1, o sigue siendo wa.me-only? */
export function hasMetaTemplateMapping(
  kind: string,
): kind is keyof typeof META_TEMPLATE_PARAM_ORDER {
  return kind in META_TEMPLATE_PARAM_ORDER;
}
