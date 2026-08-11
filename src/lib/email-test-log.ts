/**
 * Registro de pruebas de email.
 *
 * Permite ejecutar envíos de prueba, guardar el resultado por destinatario
 * (tiempos y errores) y consultar el historial. Todo pasa obligatoriamente por
 * la política de sandbox: ningún envío puede saltarse `resolveEmailRecipient`.
 */

import {
  isValidEmail,
  normalizeEmail,
  resolveEmailRecipient,
  type EmailSandboxConfig,
} from "@/lib/email-sandbox";
import type { PreflightReport } from "@/lib/email-preflight";

/** Un preflight aprobado caduca a los 10 minutos. */
const PREFLIGHT_VIGENCIA_MS = 10 * 60 * 1000;

function preflightVigente(report: PreflightReport | null): boolean {
  if (!report || !report.ok) return false;
  return Date.now() - new Date(report.checkedAt).getTime() < PREFLIGHT_VIGENCIA_MS;
}


export type EmailTestTemplate =
  | "review_requested"
  | "review_approved"
  | "review_changes"
  | "review_cancelled"
  | "note_reverted"
  | "smoke_test";

export type EmailTemplateVariable = {
  clave: string;
  label: string;
  ejemplo: string;
  /** Si es requerida, el preflight falla cuando no tiene valor. */
  requerida: boolean;
};

export type EmailTemplateDef = {
  id: EmailTestTemplate;
  label: string;
  /** Asunto con marcadores `{{variable}}`. */
  asunto: string;
  /** Cuerpo con marcadores `{{variable}}`. */
  cuerpo: string;
  descripcion: string;
  variables: EmailTemplateVariable[];
};

const V = {
  clinica: {
    clave: "clinica",
    label: "Nombre de la clínica",
    ejemplo: "Clínica Oralia Centro",
    requerida: true,
  },
  profesional: {
    clave: "profesional",
    label: "Profesional",
    ejemplo: "Dra. Ana Ruiz",
    requerida: true,
  },
  paciente: { clave: "paciente", label: "Paciente", ejemplo: "Luis Herrera", requerida: true },
  enlace: {
    clave: "enlace",
    label: "Enlace a la nota",
    ejemplo: "https://oralia.app/pacientes/123",
    requerida: true,
  },
  comentario: {
    clave: "comentario",
    label: "Comentario del revisor",
    ejemplo: "Falta detallar el diagnóstico diferencial.",
    requerida: true,
  },
  version: { clave: "version", label: "Versión restaurada", ejemplo: "v3", requerida: true },
} satisfies Record<string, EmailTemplateVariable>;

export const EMAIL_TEST_TEMPLATES: EmailTemplateDef[] = [
  {
    id: "review_requested",
    label: "Nota enviada a revisión",
    asunto: "{{clinica}}: nota de {{paciente}} lista para revisar",
    cuerpo:
      "Hola {{profesional}}:\n\nLa nota clínica de {{paciente}} entró a revisión en {{clinica}}.\nRevísala aquí: {{enlace}}",
    descripcion: "Aviso al revisor asignado cuando una nota firmada entra a revisión.",
    variables: [V.clinica, V.profesional, V.paciente, V.enlace],
  },
  {
    id: "review_approved",
    label: "Revisión aprobada",
    asunto: "{{clinica}}: tu nota de {{paciente}} fue aprobada",
    cuerpo:
      "Hola {{profesional}}:\n\n{{clinica}} aprobó la nota clínica de {{paciente}}.\nConsúltala aquí: {{enlace}}",
    descripcion: "Confirmación al autor cuando el revisor aprueba la nota.",
    variables: [V.clinica, V.profesional, V.paciente, V.enlace],
  },
  {
    id: "review_changes",
    label: "Cambios solicitados",
    asunto: "{{clinica}}: cambios solicitados en la nota de {{paciente}}",
    cuerpo:
      "Hola {{profesional}}:\n\nEl revisor solicitó cambios en la nota de {{paciente}}.\n\nComentario: {{comentario}}\n\nAbre la nota: {{enlace}}",
    descripcion: "Incluye el comentario del revisor y el enlace directo a la nota.",
    variables: [V.clinica, V.profesional, V.paciente, V.comentario, V.enlace],
  },
  {
    id: "review_cancelled",
    label: "Revisión cancelada",
    asunto: "{{clinica}}: se canceló la revisión de la nota de {{paciente}}",
    cuerpo:
      "Hola {{profesional}}:\n\nSe canceló la revisión de la nota de {{paciente}} en {{clinica}}.\nNo se requiere ninguna acción de tu parte.",
    descripcion: "Aviso al revisor cuando quien solicitó la revisión la cancela.",
    variables: [V.clinica, V.profesional, V.paciente],
  },
  {
    id: "note_reverted",
    label: "Nota revertida a borrador",
    asunto: "{{clinica}}: se restauró {{version}} de la nota de {{paciente}}",
    cuerpo:
      "Hola {{profesional}}:\n\nSe restauró la {{version}} de la nota de {{paciente}} como nuevo borrador.\nTrazabilidad completa en: {{enlace}}",
    descripcion: "Trazabilidad para el equipo cuando se restaura una versión histórica.",
    variables: [V.clinica, V.profesional, V.paciente, V.version, V.enlace],
  },
  {
    id: "smoke_test",
    label: "Prueba de entregabilidad",
    asunto: "{{clinica}}: prueba de entregabilidad de Oralia",
    cuerpo:
      "Este es un correo de prueba enviado desde {{clinica}} para medir tiempos de entrega, rebotes y filtros de spam.",
    descripcion: "Correo mínimo para medir tiempos, rebotes y filtros de spam.",
    variables: [V.clinica],
  },
];

export type EmailTemplateData = Record<string, string>;

const MARCADOR = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Devuelve los marcadores `{{var}}` presentes en un texto, sin repetir. */
export function extraerMarcadores(texto: string): string[] {
  return Array.from(new Set(Array.from(texto.matchAll(MARCADOR), (m) => m[1])));
}

/** Sustituye los marcadores por sus valores; deja intactos los que falten. */
export function renderPlantilla(texto: string, datos: EmailTemplateData): string {
  return texto.replace(MARCADOR, (original, clave: string) => {
    const valor = datos[clave];
    return valor && valor.trim() ? valor.trim() : original;
  });
}

export function definicionPlantilla(id: EmailTestTemplate): EmailTemplateDef | undefined {
  return EMAIL_TEST_TEMPLATES.find((t) => t.id === id);
}

export function datosEjemplo(id: EmailTestTemplate): EmailTemplateData {
  const def = definicionPlantilla(id);
  if (!def) return {};
  return Object.fromEntries(def.variables.map((v) => [v.clave, v.ejemplo]));
}

export function etiquetaPlantilla(id: EmailTestTemplate) {
  return definicionPlantilla(id)?.label ?? id;
}


export type EmailTestStatus = "enviado" | "redirigido" | "bloqueado" | "error";

export type EmailTestEntry = {
  id: string;
  /** ISO de inicio del intento. */
  startedAt: string;
  /** Milisegundos que tardó el intento completo. */
  durationMs: number;
  template: EmailTestTemplate;
  subject: string;
  /** Destinatario solicitado por quien lanza la prueba. */
  requested: string;
  /** Destinatario final tras aplicar la política de sandbox. */
  delivered: string | null;
  status: EmailTestStatus;
  /** Motivo legible: decisión de sandbox o causa del error. */
  reason: string;
  /** Código técnico del error, cuando lo hay. */
  errorCode: string | null;
};

const STORAGE_KEY = "oralia:email-test-log";
const MAX_ENTRIES = 200;

export function leerEmailTestLog(): EmailTestEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const crudo = window.localStorage.getItem(STORAGE_KEY);
    if (!crudo) return [];
    const parsed = JSON.parse(crudo);
    return Array.isArray(parsed) ? (parsed as EmailTestEntry[]) : [];
  } catch {
    return [];
  }
}

export function guardarEmailTestLog(entries: EmailTestEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function limpiarEmailTestLog() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Puerta de entregabilidad: exige un mínimo de emails de prueba entregados
 * correctamente (enviados o redirigidos en sandbox) antes de habilitar producción.
 */
export type PuertaEntregas = {
  permitido: boolean;
  entregados: number;
  minimo: number;
  destinatarios: number;
  motivo: string;
};

export function contarEntregasExitosas(entries: EmailTestEntry[]): EmailTestEntry[] {
  return entries.filter(
    (e) => (e.status === "enviado" || e.status === "redirigido") && !e.errorCode,
  );
}

export function puertaEntregasProduccion(
  entries: EmailTestEntry[],
  minimo: number,
): PuertaEntregas {
  const exitosas = contarEntregasExitosas(entries);
  const destinatarios = new Set(exitosas.map((e) => e.delivered ?? e.requested)).size;
  const entregados = exitosas.length;
  if (minimo <= 0) {
    return {
      permitido: true,
      entregados,
      minimo,
      destinatarios,
      motivo: "No se exige un mínimo de entregas de prueba para activar producción.",
    };
  }
  if (entregados >= minimo) {
    return {
      permitido: true,
      entregados,
      minimo,
      destinatarios,
      motivo: `${entregados} de ${minimo} emails de prueba entregados correctamente.`,
    };
  }
  return {
    permitido: false,
    entregados,
    minimo,
    destinatarios,
    motivo: `Solo ${entregados} de ${minimo} emails de prueba se han entregado correctamente. Completa las pruebas antes de activar producción.`,
  };
}

/** Estado agregado por destinatario, calculado desde el historial. */
export type EmailRecipientStatus = {
  recipient: string;
  intentos: number;
  ultimoIntento: string;
  ultimoEstado: EmailTestStatus;
  ultimoMotivo: string;
  entregados: number;
  errores: number;
  bloqueados: number;
  promedioMs: number;
};

export function estadoPorDestinatario(entries: EmailTestEntry[]): EmailRecipientStatus[] {
  const mapa = new Map<string, EmailTestEntry[]>();
  for (const entry of entries) {
    const lista = mapa.get(entry.requested) ?? [];
    lista.push(entry);
    mapa.set(entry.requested, lista);
  }

  return Array.from(mapa.entries())
    .map(([recipient, lista]) => {
      const ordenadas = [...lista].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      const ultima = ordenadas[0];
      return {
        recipient,
        intentos: ordenadas.length,
        ultimoIntento: ultima.startedAt,
        ultimoEstado: ultima.status,
        ultimoMotivo: ultima.reason,
        entregados: ordenadas.filter((e) => e.status === "enviado" || e.status === "redirigido").length,
        errores: ordenadas.filter((e) => e.status === "error").length,
        bloqueados: ordenadas.filter((e) => e.status === "bloqueado").length,
        promedioMs: Math.round(
          ordenadas.reduce((total, e) => total + e.durationMs, 0) / ordenadas.length,
        ),
      };
    })
    .sort((a, b) => b.ultimoIntento.localeCompare(a.ultimoIntento));
}

/** Estado del canal de envío: sin dominio verificado no sale ningún correo real. */
export type EmailChannelStatus = {
  listo: boolean;
  motivo: string;
  codigo: string | null;
};

export const CANAL_SIN_DOMINIO: EmailChannelStatus = {
  listo: false,
  motivo:
    "No hay dominio de envío configurado: el intento se registra pero ningún correo puede salir todavía.",
  codigo: "domain_not_configured",
};

export type EjecutarPruebaInput = {
  destinatarios: string[];
  template: EmailTestTemplate;
  config: EmailSandboxConfig;
  canal?: EmailChannelStatus;
  /** Valores de las variables de la plantilla. */
  datos?: EmailTemplateData;
  /** Preflight aprobado y vigente; sin él el envío no se ejecuta. */
  preflight: PreflightReport | null;
};

/** Error lanzado cuando se intenta enviar sin una verificación previa aprobada. */
export class PreflightNoAprobadoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "PreflightNoAprobadoError";
  }
}

function nuevoId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Ejecuta una prueba por destinatario y devuelve las entradas del registro.
 * Exige un preflight aprobado, aplica la política de sandbox y solo después
 * consulta el canal real.
 */
export async function ejecutarPruebaEmail({
  destinatarios,
  template,
  config,
  canal = CANAL_SIN_DOMINIO,
  datos = {},
  preflight,
}: EjecutarPruebaInput): Promise<EmailTestEntry[]> {
  if (!preflightVigente(preflight)) {
    throw new PreflightNoAprobadoError(
      preflight
        ? preflight.ok
          ? "La verificación previa caducó. Vuelve a ejecutarla antes de enviar."
          : preflight.motivoBloqueo
        : "Ejecuta la verificación previa antes de enviar.",
    );
  }

  const plantilla = EMAIL_TEST_TEMPLATES.find((t) => t.id === template);
  const asuntoBase = renderPlantilla(plantilla?.asunto ?? "Prueba de Oralia", datos);
  const resultados: EmailTestEntry[] = [];


  for (const bruto of destinatarios) {
    const requested = normalizeEmail(bruto);
    const inicio = Date.now();
    const startedAt = new Date(inicio).toISOString();

    if (!isValidEmail(requested)) {
      resultados.push({
        id: nuevoId(),
        startedAt,
        durationMs: Date.now() - inicio,
        template,
        subject: asuntoBase,
        requested,
        delivered: null,
        status: "error",
        reason: "Dirección inválida: revisa el formato del correo.",
        errorCode: "invalid_recipient",
      });
      continue;
    }

    const decision = resolveEmailRecipient(requested, config);

    if (decision.action === "block") {
      resultados.push({
        id: nuevoId(),
        startedAt,
        durationMs: Date.now() - inicio,
        template,
        subject: asuntoBase,
        requested,
        delivered: null,
        status: "bloqueado",
        reason: decision.reason,
        errorCode: null,
      });
      continue;
    }

    const destinoFinal = decision.recipient;
    const asunto = `${decision.subjectPrefix}${asuntoBase}`;

    // Punto único de despacho real. Mientras el canal no esté listo,
    // el intento queda registrado como error explicativo.
    if (!canal.listo) {
      resultados.push({
        id: nuevoId(),
        startedAt,
        durationMs: Date.now() - inicio,
        template,
        subject: asunto,
        requested,
        delivered: null,
        status: "error",
        reason: canal.motivo,
        errorCode: canal.codigo,
      });
      continue;
    }

    resultados.push({
      id: nuevoId(),
      startedAt,
      durationMs: Date.now() - inicio,
      template,
      subject: asunto,
      requested,
      delivered: destinoFinal,
      status: decision.action === "redirect" ? "redirigido" : "enviado",
      reason: decision.reason,
      errorCode: null,
    });
  }

  return resultados;
}

export function exportarLogCsv(entries: EmailTestEntry[]) {
  const cabecera = [
    "fecha",
    "plantilla",
    "asunto",
    "destinatario_solicitado",
    "destinatario_final",
    "estado",
    "duracion_ms",
    "motivo",
    "codigo_error",
  ];
  const filas = entries.map((e) => [
    e.startedAt,
    etiquetaPlantilla(e.template),
    e.subject,
    e.requested,
    e.delivered ?? "",
    e.status,
    String(e.durationMs),
    e.reason,
    e.errorCode ?? "",
  ]);
  return [cabecera, ...filas]
    .map((fila) => fila.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}
