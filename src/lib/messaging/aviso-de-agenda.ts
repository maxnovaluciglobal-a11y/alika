import type { LecturaDeAgenda } from "@/lib/messaging/intencion-de-agenda";

/**
 * Texto del aviso al equipo cuando un paciente pide, mueve o cancela una hora
 * por WhatsApp. Puro, sin red ni base: lo usa el webhook y lo fijan los tests.
 *
 * `fuente` dice quién leyó el mensaje. Las reglas deterministas
 * (`interpretarMensajeDeAgenda`) son lo de siempre y conservan su texto. Solo
 * cuando la lectura vino del modelo (`interpretarConIA`) el aviso lo dice:
 * "Patty leyó: …". Es transparencia, no un permiso nuevo: la lectura de la IA
 * se trata igual que la de las reglas y nunca confirma ni mueve una cita.
 */
export type FuenteDeLectura = "reglas" | "ia";

export const ETIQUETA_DE_INTENCION = {
  agendar: "pide una hora",
  reagendar: "quiere mover su hora",
  cancelar: "quiere cancelar su hora",
} as const;

export function cuandoDeLectura(lectura: LecturaDeAgenda): string {
  if (!lectura.fecha) return "sin fecha indicada";
  const franja =
    lectura.franja === "manana"
      ? " por la mañana"
      : lectura.franja === "tarde"
        ? " por la tarde"
        : "";
  return `para el ${lectura.fecha}${franja}`;
}

export function avisoDeAgenda(
  lectura: LecturaDeAgenda,
  fuente: FuenteDeLectura,
): { titulo: string; detalle: string } {
  const etiqueta = ETIQUETA_DE_INTENCION[lectura.intencion];
  const detalle = `${etiqueta} ${cuandoDeLectura(lectura)}`;
  return {
    titulo: etiqueta,
    detalle: fuente === "ia" ? `Patty leyó: ${detalle}` : detalle,
  };
}
