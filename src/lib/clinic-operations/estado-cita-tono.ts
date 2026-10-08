import { etiquetaEstado, type Cita } from "@/lib/clinic-operations/clinic-data";

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

/**
 * Forma + ícono por estado (dirección híbrida, 08-oct-2026). Con
 * deuteranopía, salvia (confirmada) y ladrillo (ausente) quedan a ΔE 4,5:
 * el color solo no alcanza para el par más importante de la agenda. Cada
 * estado se distingue ahora por al menos dos canales (forma o ícono, y
 * color), y la etiqueta de texto sigue siempre visible.
 *
 * - punteado: borde punteado sin relleno (sin respuesta / por confirmar)
 * - relleno: fondo suave del tono (confirmada, ausente)
 * - solido: fondo lleno petróleo, texto papel. Único sólido: "está pasando ahora"
 * - texto: solo texto neutro, sin borde ni relleno (finalizada)
 */
export type FormaEstado = "punteado" | "relleno" | "solido" | "texto";
export type IconoEstado = "reloj" | "check" | "punto" | "doble-check" | "cruz";

export type EstiloEstadoCita = {
  tono: TonoEstado;
  forma: FormaEstado;
  icono: IconoEstado;
  /** Clases de la pastilla (borde, fondo, texto). */
  clase: string;
};

const bordeTono: Record<TonoEstado, string> = {
  success: "border-success-border",
  warning: "border-warning-border",
  info: "border-info-border",
  neutral: "border-neutral-border",
  danger: "border-destructive-border",
};

const fondoSuave: Record<TonoEstado, string> = {
  success: "bg-success-soft",
  warning: "bg-warning-soft",
  info: "bg-info-soft",
  neutral: "bg-neutral-soft",
  danger: "bg-destructive-soft",
};

const claseForma: Record<FormaEstado, (tono: TonoEstado) => string> = {
  punteado: (t) => `border-dashed ${bordeTono[t]} bg-transparent ${claseTexto[t]}`,
  // Ausente conserva el borde ladrillo: es el estado que más tiene que saltar.
  relleno: (t) =>
    `${t === "danger" ? bordeTono.danger : "border-transparent"} ${fondoSuave[t]} ${claseTexto[t]}`,
  // Texto papel sobre petróleo (≥ 7:1 en claro; en oscuro `info` es claro y
  // `background` oscuro, así que el par se invierte solo).
  solido: () => "border-info bg-info text-background",
  texto: (t) => `border-transparent bg-transparent px-0 ${claseTexto[t]}`,
};

function estilo(tono: TonoEstado, forma: FormaEstado, icono: IconoEstado): EstiloEstadoCita {
  return { tono, forma, icono, clase: claseForma[forma](tono) };
}

/** Mapa único estado → tono + forma + ícono. */
export const estiloEstadoCita: Record<Cita["estado"], EstiloEstadoCita> = {
  tentativa: estilo(tonoDeEstadoCita.tentativa, "punteado", "reloj"),
  confirmada: estilo(tonoDeEstadoCita.confirmada, "relleno", "check"),
  "en-sala": estilo(tonoDeEstadoCita["en-sala"], "solido", "punto"),
  finalizada: estilo(tonoDeEstadoCita.finalizada, "texto", "doble-check"),
  ausente: estilo(tonoDeEstadoCita.ausente, "relleno", "cruz"),
};

/** Estilo de una cita concreta: si el paciente ya avisó que viene, la
 * tentativa se ve como confirmada (misma regla que `tonoDeCita`). */
export function estiloDeCita(
  cita: Pick<Cita, "estado"> & { pacienteConfirmo?: boolean },
): EstiloEstadoCita {
  if (cita.estado === "tentativa" && cita.pacienteConfirmo) return estiloEstadoCita.confirmada;
  return estiloEstadoCita[cita.estado];
}

/** Texto de la pastilla. Una tentativa distingue si el paciente ya avisó. */
export function textoEstadoCita(cita: Pick<Cita, "estado" | "pacienteConfirmo">) {
  if (cita.estado === "tentativa") {
    return cita.pacienteConfirmo ? "Paciente confirmó" : "Sin respuesta";
  }
  return etiquetaEstado[cita.estado];
}
