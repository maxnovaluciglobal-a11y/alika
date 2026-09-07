/**
 * Lectura determinista de lo que un paciente pide por WhatsApp sobre su hora.
 *
 * ── Por qué esto no usa un modelo de lenguaje ─────────────────────────────
 * F4 del plan Clinera está definida como "agente de agendamiento acotado:
 * LLM sólo para intención y ambigüedad; disponibilidad y escritura siguen
 * deterministas". El competidor cobra desde USD 279/mes y ese piso es costo
 * de inferencia, no margen. La mayoría de los mensajes reales son cortos y
 * previsibles ("quiero hora para el jueves en la tarde"), y resolverlos con
 * reglas cuesta cero y no falla distinto cada vez.
 *
 * ── Dónde entra el modelo, cuando haya credenciales ───────────────────────
 * Acá, y sólo acá: **cuando esta función devuelve `null`**. Ese `null` es el
 * seam, no un error. Significa "no lo pude leer con confianza" y hoy termina
 * en que una persona lee el mensaje en la bandeja, que es exactamente lo que
 * pasaba antes. El día que existan las API keys, ese caso pasa al modelo sin
 * tocar nada de lo que ya funciona.
 *
 * ── La regla de seguridad, heredada de `patient-confirmation.ts` ──────────
 * Un falso negativo lo resuelve un humano leyendo la bandeja. Un falso
 * positivo crea una solicitud de hora que el paciente nunca pidió, y alguien
 * de la clínica pierde tiempo llamándolo. **Los dos errores no cuestan lo
 * mismo**, así que ante duda se devuelve `null`.
 *
 * Diferencia con la confirmación: allá un signo de pregunta descarta el
 * mensaje ("¿me confirmas la hora?" no es un "voy a ir"). Acá **no**:
 * "¿tienen hora para el jueves?" es exactamente una solicitud de hora.
 */

export type IntencionDeAgenda = "agendar" | "reagendar" | "cancelar";
export type FranjaDelDia = "manana" | "tarde";

export interface LecturaDeAgenda {
  intencion: IntencionDeAgenda;
  /** ISO `YYYY-MM-DD`, sólo si el mensaje la dice sin ambigüedad. */
  fecha: string | null;
  franja: FranjaDelDia | null;
}

/** Más largo que esto es texto libre: territorio del modelo, no de las reglas. */
const LARGO_MAXIMO = 160;

/** Quita tildes y baja a minúsculas, dejando los signos como separadores. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // marcas combinantes (tildes)
    .toLowerCase()
    .replace(/[.,;:!¡?¿"'`*_()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PALABRA_DE_CITA = /\b(hora|horas|cita|citas|turno|turnos|control|consulta)\b/;

// Los clíticos van pegados al infinitivo en español: "cancelarla",
// "reagendarlo", "moverla". Sin contemplarlos, `\bcancelar\b` no matchea
// "cancelarla" y la lectura se pierde — lo detectó el test de ambigüedad.
const CLITICO = "(?:la|lo|las|los|le|me|nos|selo|sela)?";
const VERBOS_CANCELAR = new RegExp(`\\b(?:cancelar|anular)${CLITICO}\\b`);
const NO_PUEDO_IR = /\bno (voy a poder|puedo|podre|voy a) (ir|asistir|llegar)\b/;
const VERBOS_REAGENDAR = new RegExp(
  `\\b(?:reagendar|reprogramar|cambiar|mover|correr|adelantar|atrasar)${CLITICO}\\b`,
);
const OTRO_DIA = /\b(para|a) otro (dia|horario)\b/;
const VERBOS_AGENDAR =
  /\b(agendar|reservar|sacar|pedir|tomar|dar|tienen|tendran|hay|habra|quiero|necesito|quisiera|me gustaria|puedo)\b/;

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function iso(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sumarDias(base: Date, dias: number): Date {
  // Se trabaja en espacio de fecha local, no restando milisegundos: restarle
  // duración absoluta a una fecha se corre una hora al cruzar un cambio de
  // horario de verano, que es el bug que corrompió el seed de la demo.
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
}

/**
 * Separa la franja del día de la palabra "mañana", que en español es las dos
 * cosas: "mañana" es el día siguiente y "la mañana" es antes del mediodía.
 * Se buscan primero las formas con artículo o preposición y se **borran** del
 * texto, así "mañana por la mañana" queda leído como día + franja y no como
 * una sola cosa repetida.
 */
function extraerFranja(texto: string): { franja: FranjaDelDia | null; resto: string } {
  let resto = texto;
  let franja: FranjaDelDia | null = null;

  const patronesManana = [/\b(por|en|de|a) la manana\b/, /\bla manana\b/, /\btemprano\b/];
  const patronesTarde = [
    /\b(por|en|de|a) la tarde\b/,
    /\bla tarde\b/,
    /\bdespues de(l| las| la)? \d/,
  ];

  for (const p of patronesTarde) {
    if (p.test(resto)) {
      franja = "tarde";
      resto = resto.replace(p, " ");
    }
  }
  for (const p of patronesManana) {
    if (p.test(resto)) {
      franja = franja ?? "manana";
      resto = resto.replace(p, " ");
    }
  }
  return { franja, resto: resto.replace(/\s+/g, " ").trim() };
}

/**
 * Fecha mencionada en el texto, o `null`.
 *
 * Para un día de la semana se toma **siempre la próxima ocurrencia futura**:
 * si hoy es jueves y el paciente dice "el jueves", se entiende el de la
 * semana que viene. Proponer una fecha que ya pasó es peor que proponer una
 * lejana — la segunda se corrige en un mensaje, la primera se agenda mal.
 */
function extraerFecha(texto: string, hoy: Date): string | null {
  if (/\bhoy\b/.test(texto)) return iso(hoy);
  if (/\bpasado manana\b/.test(texto)) return iso(sumarDias(hoy, 2));
  if (/\bmanana\b/.test(texto)) return iso(sumarDias(hoy, 1));

  const dia = Object.keys(DIAS_SEMANA).find((d) => new RegExp(`\\b${d}\\b`).test(texto));
  if (dia) {
    const objetivo = DIAS_SEMANA[dia];
    let delta = (objetivo - hoy.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    if (/\b(proximo|proxima|siguiente|que viene)\b/.test(texto) && delta < 7) delta += 7;
    return iso(sumarDias(hoy, delta));
  }

  const conMes = texto.match(/\b(\d{1,2}) de ([a-z]+)\b/);
  if (conMes && MESES[conMes[2]]) {
    const d = Number(conMes[1]);
    const m = MESES[conMes[2]];
    if (d >= 1 && d <= 31) {
      const año = m < hoy.getMonth() + 1 ? hoy.getFullYear() + 1 : hoy.getFullYear();
      const candidata = new Date(año, m - 1, d);
      // `new Date(2026, 1, 30)` no falla: se corre a marzo. Si el mes cambió,
      // la fecha no existía.
      if (candidata.getMonth() === m - 1) return iso(candidata);
    }
  }

  const numerica = texto.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);
  if (numerica) {
    const d = Number(numerica[1]);
    const m = Number(numerica[2]);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      const año = m < hoy.getMonth() + 1 ? hoy.getFullYear() + 1 : hoy.getFullYear();
      const candidata = new Date(año, m - 1, d);
      if (candidata.getMonth() === m - 1) return iso(candidata);
    }
  }

  return null;
}

/**
 * Lee el mensaje, o devuelve `null` si no lo entiende con confianza.
 *
 * `hoy` se pasa a propósito en vez de leer el reloj adentro: así los tests
 * fijan el resultado sin depender del día en que corren, y la clínica puede
 * pasar su propia fecha local en vez de la del servidor.
 */
export function interpretarMensajeDeAgenda(texto: string, hoy: Date): LecturaDeAgenda | null {
  if (!texto) return null;
  const limpio = normalizar(texto);
  if (!limpio || limpio.length > LARGO_MAXIMO) return null;

  const hayPalabraDeCita = PALABRA_DE_CITA.test(limpio);
  const quiereCancelar =
    (VERBOS_CANCELAR.test(limpio) && hayPalabraDeCita) || NO_PUEDO_IR.test(limpio);
  const quiereReagendar =
    (VERBOS_REAGENDAR.test(limpio) && hayPalabraDeCita) || OTRO_DIA.test(limpio);

  let intencion: IntencionDeAgenda | null = null;
  if (quiereCancelar && quiereReagendar) {
    // "cancelar y reagendar" son dos cosas distintas y opuestas en efecto.
    // Adivinar cuál quiso decir es justo el 20% que no le toca a las reglas.
    return null;
  }
  if (quiereCancelar) intencion = "cancelar";
  else if (quiereReagendar) intencion = "reagendar";
  else if (hayPalabraDeCita && VERBOS_AGENDAR.test(limpio)) intencion = "agendar";

  if (!intencion) return null;

  const { franja, resto } = extraerFranja(limpio);
  return { intencion, fecha: extraerFecha(resto, hoy), franja };
}

/**
 * El día de hoy **en el huso de la clínica**, como `Date` de calendario local.
 *
 * El webhook corre en Vercel, en UTC. Pasarle `new Date()` a
 * `interpretarMensajeDeAgenda` significa que un paciente en Santiago que
 * escribe "mañana" a las 22:00 de su noche (01:00 UTC del día siguiente)
 * recibe una fecha corrida un día entero. Es el mismo error de husos que ya
 * corrompió la agenda del seed y el default de `/agenda`.
 *
 * Se delega en `Intl` para obtener año/mes/día en ese huso y se arma un `Date`
 * de calendario, sin aritmética de offsets: así el cambio de horario de verano
 * lo resuelve la base de husos y no nosotros.
 */
export function hoyEnLaClinica(timezone: string, ahora: Date = new Date()): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(ahora)
    .split("-")
    .map(Number);
  return new Date(partes[0], partes[1] - 1, partes[2]);
}
