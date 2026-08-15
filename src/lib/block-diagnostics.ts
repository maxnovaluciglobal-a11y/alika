/**
 * Diagnóstico de acciones bloqueadas (solo desarrollo).
 *
 * Registra por qué una acción falló combinando:
 *  - el mensaje real devuelto por la base de datos / server function,
 *  - el estado real de la nota (firma + revisión),
 *  - el rol efectivo del usuario y la matriz de permisos.
 *
 * Nunca guarda contenido clínico, nombres, correos ni identificadores completos:
 * todo texto pasa por `sanitizar()` antes de almacenarse.
 */
import {
  NOTE_ACTION_LABELS,
  NOTE_STATE_LABELS,
  evaluarAccionNota,
  type NoteAction,
  type NoteState,
  type Resultado,
} from "./note-permissions";
import type { ClinicRole } from "./access";

export type { NoteAction, NoteState };

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const COMILLAS = /"[^"]{0,400}"|'[^']{0,400}'|«[^»]{0,400}»/g;
const TOKEN = /\b(?:eyJ[\w-]{10,}|sb_[\w-]{10,}|Bearer\s+[\w.-]+)/g;

/** Elimina datos sensibles de cualquier texto antes de mostrarlo o guardarlo. */
export function sanitizar(texto: string | null | undefined, max = 300): string {
  if (!texto) return "";
  return texto
    .replace(TOKEN, "[token]")
    .replace(EMAIL, "[email]")
    .replace(UUID, "[id]")
    .replace(COMILLAS, "[dato]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Deriva el estado combinado de una nota a partir de sus campos reales. */
export function estadoNota(
  status: "draft" | "signed" | null | undefined,
  reviewStatus: "none" | "pending" | "approved" | "changes_requested" | null | undefined,
): NoteState {
  if (status === "signed") {
    if (reviewStatus === "pending") return "signed_pending";
    if (reviewStatus === "approved") return "signed_approved";
    return "signed";
  }
  if (reviewStatus === "changes_requested") return "draft_changes_requested";
  return "draft";
}

type Regla = { test: RegExp; causa: string; origen: Origen };
export type Origen = "trigger" | "rls" | "validacion" | "sesion" | "red" | "desconocido";

export const ORIGEN_LABELS: Record<Origen, string> = {
  trigger: "Regla de negocio en base de datos (trigger)",
  rls: "Política de seguridad por fila (RLS)",
  validacion: "Validación de entrada",
  sesion: "Sesión o membresía de clínica",
  red: "Error de red o del servidor",
  desconocido: "Origen no identificado",
};

const REGLAS: Regla[] = [
  {
    test: /en revisi[oó]n/i,
    causa:
      "La nota tiene una revisión pendiente; hay que resolverla o cancelarla antes de modificarla.",
    origen: "trigger",
  },
  {
    test: /firmad/i,
    causa: "La nota está firmada: primero debe reabrirse a borrador.",
    origen: "trigger",
  },
  {
    test: /revisor|supervisor|asignad/i,
    causa: "Solo el revisor asignado o un administrador puede resolver esta revisión.",
    origen: "trigger",
  },
  {
    test: /no puedes? (auto|asignarte)|mismo usuario|s[ií] mismo/i,
    causa: "No se permite auto-asignarse la revisión.",
    origen: "trigger",
  },
  {
    test: /asistente/i,
    causa: "El rol asistente no puede firmar ni editar borradores ajenos.",
    origen: "trigger",
  },
  {
    test: /permis|denied|not allowed|violates row-level security|policy/i,
    causa:
      "RLS rechazó la operación: el usuario no pertenece a la clínica o su rol no la habilita.",
    origen: "rls",
  },
  {
    test: /jwt|sesi[oó]n|unauthorized|401/i,
    causa: "La sesión no llegó al servidor o expiró.",
    origen: "sesion",
  },
  {
    test: /invalid|required|zod|debe ser|inv[aá]lid/i,
    causa: "Los datos enviados no pasaron la validación de entrada.",
    origen: "validacion",
  },
  {
    test: /fetch|network|timeout|500|failed to/i,
    causa: "Falla de red o del servidor, no de permisos.",
    origen: "red",
  },
];

export interface Diagnostico {
  id: string;
  ts: number;
  accion: NoteAction;
  accionLabel: string;
  estado: NoteState;
  estadoLabel: string;
  rolReal: ClinicRole | null;
  rolSimulado: ClinicRole | null;
  esAutor: boolean | null;
  esRevisor: boolean | null;
  /** Mensaje del servidor ya sanitizado. */
  mensaje: string;
  causa: string;
  origen: Origen;
  /** Veredicto esperado según la matriz de permisos. */
  matriz: Resultado | null;
  /** true cuando la UI esperaba permitir la acción pero el servidor la bloqueó. */
  discrepancia: boolean;
}

export interface EntradaBloqueo {
  accion: NoteAction;
  estado: NoteState;
  rolReal?: ClinicRole | null;
  rolSimulado?: ClinicRole | null;
  esAutor?: boolean | null;
  esRevisor?: boolean | null;
  error: unknown;
}

let registros: Diagnostico[] = [];
const oyentes = new Set<() => void>();
const MAX = 20;

function notificar() {
  for (const fn of oyentes) fn();
}

export function suscribirBloqueos(fn: () => void) {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

export function leerBloqueos(): Diagnostico[] {
  return registros;
}

export function limpiarBloqueos() {
  registros = [];
  notificar();
}

export function reportarBloqueo(entrada: EntradaBloqueo): Diagnostico {
  const bruto =
    entrada.error instanceof Error ? entrada.error.message : String(entrada.error ?? "");
  const mensaje = sanitizar(bruto);
  const regla = REGLAS.find((r) => r.test.test(bruto));
  const rolEfectivo = entrada.rolSimulado ?? entrada.rolReal ?? null;
  const matriz = rolEfectivo
    ? evaluarAccionNota(rolEfectivo, entrada.estado, entrada.accion)
    : null;

  const diag: Diagnostico = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    accion: entrada.accion,
    accionLabel: NOTE_ACTION_LABELS[entrada.accion],
    estado: entrada.estado,
    estadoLabel: NOTE_STATE_LABELS[entrada.estado],
    rolReal: entrada.rolReal ?? null,
    rolSimulado: entrada.rolSimulado ?? null,
    esAutor: entrada.esAutor ?? null,
    esRevisor: entrada.esRevisor ?? null,
    mensaje,
    causa:
      regla?.causa ??
      "No hay una regla conocida para este mensaje; revisa el trigger o la política implicada.",
    origen: regla?.origen ?? "desconocido",
    matriz,
    discrepancia: matriz?.verdict === "allow",
  };

  registros = [diag, ...registros].slice(0, MAX);
  notificar();
  return diag;
}
