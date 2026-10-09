/**
 * Plantillas de los correos de autenticación que manda Supabase (no Resend
 * desde la app): confirmar cuenta, invitación, recuperar contraseña, enlace
 * de acceso, cambio de correo y código de verificación.
 *
 * Supabase no lee este archivo: el HTML se pega en el dashboard
 * (Authentication → Emails → Templates). Vive acá para que salga del mismo
 * `layout.ts` que los correos de ciclo de vida y no de una copia a mano.
 * Se genera con `node scripts/plantillas-auth-supabase.mjs`.
 *
 * Las variables `{{ .X }}` son de Go: Supabase las reemplaza al enviar.
 * `escapeHtml` no las toca (no escapa llaves ni puntos) y el `&` de los
 * enlaces queda como `&amp;`, que es lo correcto dentro de un `href`.
 */
import { p, pTenue, renderCorreo, type Bloque, type CorreoRenderizado } from "./layout";

/** En las plantillas, la Site URL de Supabase (`https://esmalia.com`). */
const SITE = "{{ .SiteURL }}";

export const ENLACE_RECUPERAR = `${SITE}/auth/nueva-clave?token_hash={{ .TokenHash }}&type=recovery`;
export const ENLACE_INVITACION = `${SITE}/auth/nueva-clave?token_hash={{ .TokenHash }}&type=invite`;

const MOTIVO = "Recibes este correo por una acción en tu cuenta de Esmalia.";
const NO_FUISTE = pTenue(
  "Si no fuiste tú, puedes ignorar este correo: sin abrir el enlace no cambia nada.",
);

function boton(texto: string, href: string): Bloque {
  return { tipo: "boton", texto, href };
}

function correo(
  asunto: string,
  preencabezado: string,
  titulo: string,
  bloques: Bloque[],
): CorreoRenderizado {
  return renderCorreo({
    appUrl: SITE,
    asunto,
    preencabezado,
    titulo,
    bloques,
    pie: { motivo: MOTIVO },
  });
}

export type PlantillaAuth =
  | "confirmar-cuenta"
  | "invitacion"
  | "recuperar-clave"
  | "enlace-acceso"
  | "cambio-correo"
  | "codigo-verificacion";

export function plantillasAuth(): Record<PlantillaAuth, CorreoRenderizado> {
  return {
    "confirmar-cuenta": correo(
      "Confirma tu correo para entrar a Esmalia",
      "Un clic y tu clínica queda lista para empezar.",
      "Confirma tu correo",
      [
        p("Gracias por crear tu cuenta. Confirma que este correo es tuyo para entrar a Esmalia."),
        boton("Confirmar mi correo", "{{ .ConfirmationURL }}"),
        pTenue("El enlace funciona una sola vez y vence en poco tiempo."),
        NO_FUISTE,
      ],
    ),
    invitacion: correo(
      "Te invitaron al equipo de tu clínica en Esmalia",
      "Crea tu contraseña y entra a la agenda de tu clínica.",
      "Te invitaron a Esmalia",
      [
        p(
          "Tu clínica te sumó a su equipo en Esmalia, donde llevan la agenda, las fichas de los pacientes y los cobros.",
        ),
        p("Para entrar, crea tu contraseña:"),
        boton("Crear mi contraseña", ENLACE_INVITACION),
        pTenue(
          "El enlace funciona una sola vez y vence en poco tiempo. Si vence, entra a esmalia.com/auth y usa «Olvidé mi contraseña» con este mismo correo.",
        ),
        pTenue("Si no esperabas esta invitación, puedes ignorar este correo."),
      ],
    ),
    "recuperar-clave": correo(
      "Crea tu contraseña nueva de Esmalia",
      "Pediste cambiar tu contraseña. El enlace vence en una hora.",
      "Crea tu contraseña nueva",
      [
        p("Pediste cambiar la contraseña de tu cuenta de Esmalia ({{ .Email }})."),
        boton("Crear contraseña nueva", ENLACE_RECUPERAR),
        pTenue("El enlace funciona una sola vez y vence en una hora."),
        pTenue(
          "Si no lo pediste, ignora este correo: tu contraseña actual sigue igual y nadie entra sin abrir este enlace.",
        ),
      ],
    ),
    "enlace-acceso": correo(
      "Tu enlace para entrar a Esmalia",
      "Entra sin contraseña con este enlace.",
      "Tu enlace para entrar",
      [
        p("Usa este botón para entrar a tu cuenta de Esmalia."),
        boton("Entrar a Esmalia", "{{ .ConfirmationURL }}"),
        pTenue("El enlace funciona una sola vez y vence en una hora."),
        NO_FUISTE,
      ],
    ),
    "cambio-correo": correo(
      "Confirma tu correo nuevo en Esmalia",
      "Confirma el cambio de correo de tu cuenta.",
      "Confirma tu correo nuevo",
      [
        p(
          "Pediste cambiar el correo de tu cuenta de Esmalia de ",
          { negrita: "{{ .Email }}" },
          " a ",
          { negrita: "{{ .NewEmail }}" },
          ".",
        ),
        boton("Confirmar el cambio", "{{ .ConfirmationURL }}"),
        NO_FUISTE,
      ],
    ),
    "codigo-verificacion": correo(
      "Tu código de verificación de Esmalia",
      "Usa este código para confirmar que eres tú.",
      "Tu código de verificación",
      [
        p("Escribe este código en Esmalia para confirmar que eres tú:"),
        { tipo: "cifra", etiqueta: "Código", valor: "{{ .Token }}" },
        pTenue("El código vence en pocos minutos."),
        NO_FUISTE,
      ],
    ),
  };
}
