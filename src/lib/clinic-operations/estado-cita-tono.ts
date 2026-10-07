import type { Cita } from "@/lib/clinic-operations/clinic-data";

/**
 * Un solo mapa de color para los estados de cita (auditoría 07-oct-2026):
 * antes Hoy, la grilla de Agenda y las vistas semana/mes tenían cada una el
 * suyo y se contradecían ("ausente" era rojo en Hoy y gris en Agenda), y
 * confirmada / en sala / por confirmar eran tres marrones casi iguales.
 *
 * Los tonos salen de los tokens semánticos de styles.css (salvia, siena,
 * petróleo, ladrillo, neutro). El texto de la etiqueta sigue siendo
 * obligatorio: el color acompaña, no informa solo.
 */
export type TonoEstado = "success" | "warning" | "info" | "neutral" | "danger";

export const tonoDeEstadoCita: Record<Cita["estado"], TonoEstado> = {
  confirmada: "success",
  tentativa: "warning",
  "en-sala": "info",
  finalizada: "neutral",
  ausente: "danger",
};

/** Etiqueta con borde (tablas, listas). */
export const clasePastilla: Record<TonoEstado, string> = {
  success: "border-success-border bg-success-soft text-success",
  warning: "border-dashed border-warning-border bg-warning-soft text-warning",
  info: "border-info-border bg-info-soft text-info",
  neutral: "border-neutral-border bg-neutral-soft text-neutral",
  danger: "border-destructive-border bg-destructive-soft text-destructive",
};

/** Solo el color del texto (cifras de Hoy, notas). */
export const claseTexto: Record<TonoEstado, string> = {
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  neutral: "text-neutral",
  danger: "text-destructive",
};

/** Bloque de la grilla: el borde izquierdo es del profesional, así que el
 * estado vive en el fondo y el texto. */
export const claseBloque: Record<TonoEstado, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  neutral: "bg-neutral-soft text-neutral",
  danger: "bg-destructive-soft text-destructive",
};

/** Tono de una cita concreta: una tentativa que el paciente ya confirmó
 * por WhatsApp se muestra como confirmada aunque falte el visto del
 * profesional. */
export function tonoDeCita(cita: Pick<Cita, "estado"> & { pacienteConfirmo?: boolean }) {
  if (cita.estado === "tentativa" && cita.pacienteConfirmo) return "success";
  return tonoDeEstadoCita[cita.estado];
}
