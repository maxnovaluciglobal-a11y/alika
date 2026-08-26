/**
 * Envío real de email — la pieza que faltaba en la infraestructura ya
 * construida (dns-email.ts autentica el dominio, email-sandbox.ts decide
 * el destinatario). Server-only: usa RESEND_API_KEY, nunca debe importarse
 * desde código de cliente.
 *
 * El sandbox de `/sandbox-email` (email-sandbox.ts) vive hoy SOLO en
 * localStorage del navegador — nunca llegó al servidor porque hasta acá no
 * había ningún envío real que gatear. Este módulo usa la variable de
 * entorno EMAIL_SANDBOX en su lugar (server-side, con default seguro). Son
 * dos gates independientes por ahora — unificarlos (mover la config de
 * sandbox a una tabla) queda pendiente, no es parte de este cambio.
 */
import { Resend } from "resend";

export type SendEmailResult =
  | { ok: true; externalId: string | null; recipient: string; sandboxed: boolean }
  | { ok: false; reason: string };

function isSandboxMode(): boolean {
  // Default true a propósito: sin la env var seteada explícitamente en
  // "false", nunca se manda un email real por accidente.
  return process.env.EMAIL_SANDBOX !== "false";
}

/**
 * Envía un email. En sandbox (default), se redirige a EMAIL_SANDBOX_REDIRECT_TO si
 * está seteada, o se bloquea sin llamar a Resend si no hay ninguna
 * dirección de prueba configurada — nunca sale nada a un destinatario real
 * por accidente.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return {
      ok: false,
      reason:
        "Envío de email no configurado todavía (falta RESEND_API_KEY o EMAIL_FROM en el servidor).",
    };
  }

  const sandbox = isSandboxMode();
  let recipient = params.to;
  let subject = params.subject;

  if (sandbox) {
    const sandboxTo = process.env.EMAIL_SANDBOX_REDIRECT_TO;
    if (!sandboxTo) {
      return {
        ok: false,
        reason:
          "Modo sandbox activo y sin EMAIL_SANDBOX_REDIRECT_TO configurada: el envío se bloqueó para no mandar nada real por accidente.",
      };
    }
    recipient = sandboxTo;
    subject = `[SANDBOX → ${params.to}] ${params.subject}`;
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: recipient,
    subject,
    html: params.html,
  });

  if (error) {
    return { ok: false, reason: error.message };
  }

  return { ok: true, externalId: data?.id ?? null, recipient, sandboxed: sandbox };
}
