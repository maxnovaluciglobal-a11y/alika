/**
 * Resumen diario para el equipo de la clínica (F3 del plan Clinera).
 *
 * ⚠️ Este cron NUNCA le escribe a un paciente. En `messaging.functions.ts`
 * está registrada la decisión: el outreach se arma en la app y lo despacha
 * una persona. Acá el cron solo cuenta lo que quedó pendiente y le avisa al
 * equipo. Esa restricción también es lo que lo hace funcionar hoy: mandar
 * por WhatsApp necesita las credenciales de Meta y mandar por email necesita
 * Resend, pero avisar dentro de la app no necesita ninguna de las dos.
 *
 * Lógica pura, sin DB: la decide `api.daily-digest.ts` y la testea
 * `tests/digest-diario.test.ts` sin levantar Postgres.
 */

/** Hora local a la que sale el resumen. El cron corre cada hora y filtra. */
export const HORA_DEL_RESUMEN = 8;

/**
 * Ventana para no repetir el resumen del día.
 *
 * A propósito NO es "desde la medianoche local": calcular medianoche en un
 * huso arbitrario exige aritmética de calendario, que es justo donde el
 * cambio de hora rompe las cosas en silencio. Como el resumen sale una sola
 * vez por día a una hora fija, preguntar "¿hubo uno en las últimas 20 h?"
 * responde lo mismo y no depende del calendario.
 */
export const VENTANA_DEDUPE_MS = 20 * 60 * 60 * 1000;

/** Tope de clínicas por corrida, para que la función no se pase de tiempo. */
export const TOPE_CLINICAS_POR_CORRIDA = 200;

export const TIMEZONE_POR_DEFECTO = "America/Santiago";

/**
 * Hora (0-23) que marca el reloj en ese huso. Delega en `Intl`, que consulta
 * la base de husos: es correcto en los cambios de hora sin que nosotros
 * hagamos ninguna cuenta. Un huso inválido cae al de la clínica por defecto
 * en vez de tirar la corrida entera abajo.
 */
export function horaLocal(momento: Date, timezone: string): number {
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hourCycle: "h23",
      }).format(momento),
    );
  } catch {
    if (timezone === TIMEZONE_POR_DEFECTO) return NaN;
    return horaLocal(momento, TIMEZONE_POR_DEFECTO);
  }
}

/** ¿Es la hora del resumen en ese huso? */
export function esHoraDelResumen(
  momento: Date,
  timezone: string,
  horaObjetivo: number = HORA_DEL_RESUMEN,
): boolean {
  return horaLocal(momento, timezone) === horaObjetivo;
}

/** Instante desde el cual buscar un resumen ya enviado (freno anti-repetición). */
export function desdeCuandoBuscarDuplicado(momento: Date): string {
  return new Date(momento.getTime() - VENTANA_DEDUPE_MS).toISOString();
}

export interface InsumosResumen {
  /** Recordatorios de cita listos para despachar. */
  recordatorios: number;
  /** Hilos cuyo último mensaje es del paciente. */
  sinResponder: number;
}

export interface Resumen {
  titulo: string;
  cuerpo: string;
  link: string;
}

const plural = (n: number, singular: string, muchos: string) => (n === 1 ? singular : muchos);

/**
 * Arma el aviso, o devuelve `null` si no hay nada que decir.
 *
 * El `null` es un freno, no un caso borde: un resumen que llega todos los
 * días aunque no haya nada deja de leerse a la semana. Si no hay nada
 * pendiente, el equipo no recibe nada.
 */
export function armarResumen(insumos: InsumosResumen): Resumen | null {
  const rec = Math.max(0, Math.trunc(insumos.recordatorios));
  const sin = Math.max(0, Math.trunc(insumos.sinResponder));
  if (rec === 0 && sin === 0) return null;

  const frRec = `${rec} ${plural(rec, "recordatorio", "recordatorios")}`;
  const frSin = `${sin} ${plural(sin, "conversación", "conversaciones")} sin responder`;

  if (rec > 0 && sin > 0) {
    return {
      titulo: `Hay ${frRec} y ${frSin}`,
      cuerpo: `Los recordatorios se despachan desde Recordatorios; ${plural(
        sin,
        "la conversación te espera",
        "las conversaciones te esperan",
      )} en Conversaciones.`,
      link: "/recordatorios",
    };
  }
  if (rec > 0) {
    return {
      titulo: `Hay ${frRec} para mandar hoy`,
      cuerpo: `${plural(rec, "Corresponde", "Corresponden")} a citas de las próximas 48 horas.`,
      link: "/recordatorios",
    };
  }
  return {
    titulo: `Hay ${frSin}`,
    cuerpo: `${plural(
      sin,
      "Un paciente escribió",
      "Hay pacientes que escribieron",
    )} y todavía nadie contestó.`,
    link: "/conversaciones",
  };
}
