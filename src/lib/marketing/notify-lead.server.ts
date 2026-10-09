// src/lib/marketing/notify-lead.server.ts
//
// Hallazgo del 24/25-sep: un lead de `marketing_leads` (calculadora, checklist,
// benchmark, demo) no llega a NINGÚN lado salvo que alguien entre a
// `/admin/leads` a mano — no hay email, no hay Slack, nada. Mismo modo de
// falla que el `daily-digest` de WhatsApp evita a propósito para citas: acá
// no había ni siquiera el intento. Este notificador es el mínimo cierre —
// server-only, best-effort, nunca bloquea ni hace fallar el alta del lead.
//
// Deliberadamente NO reusa `sendEmail` de `email.server.ts`: ese helper pasa
// TODO por `resolveEmailRecipient` (gate de sandbox pensado para emails a
// PACIENTES de una clínica). Un lead no tiene `clinic_id` — el destinatario
// acá es el equipo de Esmalia (`ALIKA_STAFF_EMAILS`), no un paciente, así que
// aplicar ese gate sería la comprobación equivocada, no una de más.
import { Resend } from "resend";

type DatosNotificacion = {
  esNuevo: boolean;
  source: string;
  countryCode: string;
  name: string | null;
  clinicName: string | null;
  email: string | null;
  phone: string | null;
};

/**
 * A quién le llega el aviso. `LEADS_NOTIFY_EMAILS` existe porque
 * `ALIKA_STAFF_EMAILS` también es la allowlist de `/admin`: Walter entra con
 * su cuenta personal, pero los leads tienen que ir solo al correo de la
 * empresa. Sin la variable propia, se cae a la allowlist de siempre.
 */
export function destinatariosStaff(env: NodeJS.ProcessEnv = process.env): string[] {
  const lista = env.LEADS_NOTIFY_EMAILS?.trim() ? env.LEADS_NOTIFY_EMAILS : env.ALIKA_STAFF_EMAILS;
  return (lista ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/**
 * No lanza NUNCA — un fallo acá (Resend caído, falta la key, etc.) no debe
 * tumbar `submitMarketingLead` ni ocultar al lead detrás de un 500. El único
 * costo de que falle es que el aviso no llegó; el lead ya está guardado en
 * `marketing_leads` de todos modos y sigue visible en `/admin/leads`.
 */
export async function notificarNuevoLead(datos: DatosNotificacion): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    const staff = destinatariosStaff();
    if (!apiKey || !from || staff.length === 0) {
      console.warn(
        "[leads] Sin notificar: falta RESEND_API_KEY, EMAIL_FROM o LEADS_NOTIFY_EMAILS/ALIKA_STAFF_EMAILS.",
      );
      return;
    }

    const contacto = [
      datos.email ? `Email: ${datos.email}` : null,
      datos.phone ? `WhatsApp: ${datos.phone}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const asunto = datos.esNuevo
      ? `Nuevo lead (${datos.source}) — ${datos.name ?? datos.clinicName ?? "sin nombre"}`
      : `Lead reenvió el formulario (${datos.source}) — ${datos.name ?? datos.clinicName ?? "sin nombre"}`;

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: staff,
      subject: asunto,
      html: `
        <p><strong>Fuente:</strong> ${datos.source} · <strong>País:</strong> ${datos.countryCode}</p>
        <p><strong>Nombre:</strong> ${datos.name ?? "—"}</p>
        <p><strong>Clínica:</strong> ${datos.clinicName ?? "—"}</p>
        <p>${contacto || "Sin datos de contacto (no debería pasar — revisar)"}</p>
        <p><a href="${process.env.PUBLIC_APP_URL ?? ""}/admin/leads">Ver en /admin/leads</a></p>
      `.trim(),
    });
    if (error) {
      console.error("[leads] fallo al notificar por email:", error.message);
    }
  } catch (err) {
    console.error(
      "[leads] excepción notificando lead (no bloquea el alta):",
      err instanceof Error ? err.message : err,
    );
  }
}
