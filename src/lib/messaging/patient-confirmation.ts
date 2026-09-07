/**
 * Reconocimiento del "sí" del paciente por WhatsApp.
 *
 * ── Por qué esto existe otra vez ──────────────────────────────────────────
 * La confirmación automática existió y se removió en `505eb7d` (01-sep-2026)
 * por pedido de una clienta potencial. El motivo NO era que la función
 * sobrara: era que Alika usaba **un solo estado `confirmada` para dos hechos
 * distintos** — que el odontólogo aceptó la cita, y que el paciente avisó que
 * viene. Al colapsarlos, dejar que el paciente escribiera "SI" le daba
 * permiso de escritura sobre la agenda del profesional.
 *
 * Esto NO revierte aquel commit. `confirmed_at`/`confirmed_by` siguen siendo
 * del profesional, con su RLS intacta, y nada de acá los toca. El aviso del
 * paciente vive en un eje aparte: `patient_confirmed_at`.
 *
 * ── La regla de seguridad ─────────────────────────────────────────────────
 * Se compara el mensaje COMPLETO, nunca una subcadena. "si me confirmás la
 * hora voy" contiene "si" y "voy" y aun así no es una confirmación: es una
 * pregunta. Falso negativo = alguien de la clínica lee el mensaje en la
 * bandeja y lo resuelve. Falso positivo = la agenda dice que el paciente
 * viene y el paciente nunca lo dijo. Los dos errores NO cuestan lo mismo.
 */

/** Quita tildes, signos y espacios de más para comparar contra una lista corta. */
export function normalizarRespuesta(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // marcas combinantes (tildes)
    .toUpperCase()
    .replace(/[.,;:!¡"'`*_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Frases que cuentan como "voy a ir". Deliberadamente corta y literal: cada
 * entrada nueva es una forma más de confirmar una cita que nadie confirmó.
 */
const CONFIRMACIONES = new Set([
  "SI",
  "SII",
  "SIP",
  "SI SI",
  "OK",
  "OKA",
  "OKEY",
  "OKAY",
  "DALE",
  "LISTO",
  "PERFECTO",
  "CONFIRMO",
  "CONFIRMADO",
  "CONFIRMADA",
  "SI CONFIRMO",
  "CONFIRMO LA CITA",
  "CONFIRMO LA HORA",
  "VOY",
  "SI VOY",
  "AHI VOY",
  "SI AHI VOY",
  "AHI ESTARE",
  "ALLI ESTARE",
  "SI GRACIAS",
  "GRACIAS SI",
  "DE ACUERDO",
  "ASISTIRE",
  "SI ASISTIRE",
  "SI ESTARE",
  "SI NOS VEMOS",
  "NOS VEMOS",
]);

/**
 * ¿El paciente está confirmando que viene?
 *
 * Devuelve false ante cualquier duda. Tres cortes antes de mirar la lista:
 * una pregunta no es una confirmación, algo que arranca con "NO" tampoco, y
 * un texto largo es una conversación que necesita a un humano.
 */
export function esConfirmacionDePaciente(texto: string): boolean {
  if (texto.includes("?") || texto.includes("¿")) return false;

  const limpio = normalizarRespuesta(texto);
  if (!limpio) return false;
  // 24 caracteres: "SI AHI VOY GRACIAS" entra, un párrafo no. Sin esto la
  // lista tendría que anticipar toda negación posible.
  if (limpio.length > 24) return false;
  // "NO", "NO VOY", "NO PUEDO", "NO SE" — y también "NO, SI VOY", que es
  // ambiguo de verdad y merece que lo lea una persona.
  if (/^NO\b/.test(limpio)) return false;

  return CONFIRMACIONES.has(limpio);
}
