import avatarPaciente1 from "@/assets/avatar-paciente-1.jpg";

export type EstadoCita = "confirmada" | "en-sala" | "ausente" | "finalizada" | "tentativa";
export type EstadoPaciente = "activo" | "nuevo" | "inactivo";
export type EstadoTratamiento = "presupuestado" | "en-curso" | "pausado" | "finalizado";

/** Fecha de referencia del prototipo (jueves) */
export const HOY = "2026-10-24";

export interface Sucursal {
  id: string;
  nombre: string;
  ciudad: string;
}

export interface Cita {
  id: string;
  pacienteId: string;
  paciente: string;
  tratamiento: string;
  profesionalId: string;
  sucursalId: string;
  /** ISO yyyy-mm-dd */
  fecha: string;
  /** minutos desde las 08:00 */
  inicio: number;
  duracion: number;
  estado: EstadoCita;
  prioridad?: boolean;
}

export interface Profesional {
  id: string;
  nombre: string;
  box: string;
  especialidad: string;
  sucursalId: string;
}

export interface EventoClinico {
  fecha: string;
  titulo: string;
  detalle?: string;
  tipo: "consulta" | "imagen" | "presupuesto" | "control";
  actual?: boolean;
}

export interface Paciente {
  id: string;
  nombre: string;
  documento: string;
  edad: number;
  telefono: string;
  email: string;
  sucursalId: string;
  profesionalId: string;
  estado: EstadoPaciente;
  ultimaVisita: string;
  /** ISO yyyy-mm-dd de la última visita, para filtros por rango */
  ultimaVisitaISO: string;
  proximoControl: string | null;
  /** null = sin facturación registrada todavía (módulo de finanzas, fase 3) */
  saldo: number | null;
  /** null = aún no calculado (IA de predicción de ausencias, fase 4) */
  riesgoAusencia: number | null;
  etiquetas: string[];
  foto?: string;
  resumenIA: string;
  timeline: EventoClinico[];
  /** Consentimiento para outreach proactivo por WhatsApp (recall/reseña/saldo) — no gatea los recordatorios de cita. */
  waOptIn: boolean;
}

export interface Tratamiento {
  id: string;
  pacienteId: string;
  plan: string;
  avance: number;
  profesionalId: string;
  sucursalId: string;
  estado: EstadoTratamiento;
  /** ISO yyyy-mm-dd de inicio del plan */
  fecha: string;
}

export const sucursales: Sucursal[] = [
  { id: "s1", nombre: "Sede Providencia", ciudad: "Santiago" },
  { id: "s2", nombre: "Sede Las Condes", ciudad: "Santiago" },
];

export const profesionales: Profesional[] = [
  {
    id: "p1",
    nombre: "Dr. Méndez",
    box: "Box 1",
    especialidad: "Rehabilitación",
    sucursalId: "s1",
  },
  { id: "p2", nombre: "Dra. Luna", box: "Box 2", especialidad: "Endodoncia", sucursalId: "s1" },
  {
    id: "p3",
    nombre: "Dra. Rivas",
    box: "Box 3",
    especialidad: "Odontopediatría",
    sucursalId: "s2",
  },
];

export const HORA_INICIO = 8;
export const HORAS_VISIBLES = 7;
export const PIXELES_POR_MINUTO = 1.35;

export const citas: Cita[] = [
  {
    id: "c1",
    pacienteId: "pa1",
    paciente: "Sofía Rodríguez",
    tratamiento: "Limpieza + Profilaxis",
    profesionalId: "p1",
    sucursalId: "s1",
    fecha: HOY,
    inicio: 60,
    duracion: 60,
    estado: "en-sala",
  },
  {
    id: "c2",
    pacienteId: "pa3",
    paciente: "Camila Duarte",
    tratamiento: "Revisión general",
    profesionalId: "p1",
    sucursalId: "s1",
    fecha: HOY,
    inicio: 180,
    duracion: 45,
    estado: "confirmada",
  },
  {
    id: "c3",
    pacienteId: "pa4",
    paciente: "Roberto Gómez",
    tratamiento: "Control ortodoncia",
    profesionalId: "p1",
    sucursalId: "s1",
    fecha: HOY,
    inicio: 300,
    duracion: 30,
    estado: "ausente",
  },
  {
    id: "c4",
    pacienteId: "pa2",
    paciente: "Juan P. Valdés",
    tratamiento: "Endodoncia conducto",
    profesionalId: "p2",
    sucursalId: "s1",
    fecha: HOY,
    inicio: 90,
    duracion: 90,
    estado: "confirmada",
    prioridad: true,
  },
  {
    id: "c5",
    pacienteId: "pa5",
    paciente: "Lucía Méndez",
    tratamiento: "Cementado de corona",
    profesionalId: "p2",
    sucursalId: "s1",
    fecha: HOY,
    inicio: 240,
    duracion: 60,
    estado: "finalizada",
  },
  {
    id: "c6",
    pacienteId: "pa6",
    paciente: "Tomás Arriagada",
    tratamiento: "Sellantes preventivos",
    profesionalId: "p3",
    sucursalId: "s2",
    fecha: HOY,
    inicio: 120,
    duracion: 45,
    estado: "confirmada",
  },
  {
    id: "c7",
    pacienteId: "pa7",
    paciente: "Valentina Soto",
    tratamiento: "Primera consulta infantil",
    profesionalId: "p3",
    sucursalId: "s2",
    fecha: HOY,
    inicio: 270,
    duracion: 30,
    estado: "tentativa",
  },
  {
    id: "c8",
    pacienteId: "pa1",
    paciente: "Sofía Rodríguez",
    tratamiento: "Control de fluoración",
    profesionalId: "p1",
    sucursalId: "s1",
    fecha: "2026-10-25",
    inicio: 60,
    duracion: 30,
    estado: "tentativa",
  },
  {
    id: "c9",
    pacienteId: "pa2",
    paciente: "Juan P. Valdés",
    tratamiento: "Endodoncia — sesión 2",
    profesionalId: "p2",
    sucursalId: "s1",
    fecha: "2026-10-25",
    inicio: 150,
    duracion: 90,
    estado: "confirmada",
  },
  {
    id: "c10",
    pacienteId: "pa6",
    paciente: "Tomás Arriagada",
    tratamiento: "Control de sellantes",
    profesionalId: "p3",
    sucursalId: "s2",
    fecha: "2026-10-26",
    inicio: 90,
    duracion: 30,
    estado: "tentativa",
  },
  {
    id: "c11",
    pacienteId: "pa4",
    paciente: "Roberto Gómez",
    tratamiento: "Reagendamiento ortodoncia",
    profesionalId: "p1",
    sucursalId: "s1",
    fecha: "2026-10-23",
    inicio: 210,
    duracion: 30,
    estado: "ausente",
  },
  {
    id: "c12",
    pacienteId: "pa5",
    paciente: "Lucía Méndez",
    tratamiento: "Prueba de estructura",
    profesionalId: "p2",
    sucursalId: "s1",
    fecha: "2026-10-23",
    inicio: 60,
    duracion: 60,
    estado: "finalizada",
  },
];

export const listaEspera = [
  { id: "le1", nombre: "Elena Paz", motivo: "Dolor agudo · urgencia", espera: "15 min" },
  { id: "le2", nombre: "Andrés Rivas", motivo: "Cancelación previa · disponible hoy", espera: "—" },
  { id: "le3", nombre: "Paula Ibáñez", motivo: "Control post operatorio", espera: "—" },
];

export const pacientes: Paciente[] = [
  {
    id: "pa1",
    nombre: "Sofía Rodríguez",
    documento: "28.349.201",
    edad: 28,
    telefono: "+56 9 8842 1190",
    email: "sofia.rodriguez@mail.com",
    sucursalId: "s1",
    profesionalId: "p1",
    estado: "activo",
    ultimaVisita: "Hoy",
    ultimaVisitaISO: HOY,
    proximoControl: "14 Nov 2026",
    saldo: 0,
    riesgoAusencia: 8,
    etiquetas: ["Preventivo", "Al día"],
    foto: avatarPaciente1,
    resumenIA:
      "Paciente muestra tendencia a caries interproximales. Sugerir cambio a cepillo eléctrico y kit de irrigador bucal en el control de noviembre.",
    timeline: [
      {
        fecha: "Hoy · 09:15",
        titulo: "Inicio tratamiento profilaxis",
        detalle: "Sensibilidad en molares inferiores. Se sugiere fluoración.",
        tipo: "consulta",
        actual: true,
      },
      { fecha: "12 Ago 2026", titulo: "Radiografía panorámica", tipo: "imagen" },
      { fecha: "05 Ene 2026", titulo: "Consulta inicial", tipo: "consulta" },
    ],
    waOptIn: false,
  },
  {
    id: "pa2",
    nombre: "Juan P. Valdés",
    documento: "19.774.033",
    edad: 41,
    telefono: "+56 9 7712 4408",
    email: "jp.valdes@mail.com",
    sucursalId: "s1",
    profesionalId: "p2",
    estado: "activo",
    ultimaVisita: "12 Oct 2026",
    ultimaVisitaISO: "2026-10-12",
    proximoControl: "Hoy",
    saldo: 148000,
    riesgoAusencia: 34,
    etiquetas: ["Endodoncia", "Saldo pendiente"],
    resumenIA:
      "Tratamiento de conducto en curso (sesión 1 de 2). Saldo pendiente de $148.000; historial de pago puntual. Recordar consentimiento firmado antes de la segunda sesión.",
    timeline: [
      {
        fecha: "Hoy · 09:30",
        titulo: "Endodoncia conducto — sesión 1",
        tipo: "consulta",
        actual: true,
      },
      {
        fecha: "12 Oct 2026",
        titulo: "Presupuesto aceptado",
        detalle: "Plan integral 4 piezas.",
        tipo: "presupuesto",
      },
      { fecha: "28 Sep 2026", titulo: "Radiografía periapical", tipo: "imagen" },
    ],
    waOptIn: false,
  },
  {
    id: "pa3",
    nombre: "Camila Duarte",
    documento: "21.008.554",
    edad: 33,
    telefono: "+56 9 6620 7781",
    email: "camila.duarte@mail.com",
    sucursalId: "s1",
    profesionalId: "p1",
    estado: "activo",
    ultimaVisita: "02 Sep 2026",
    ultimaVisitaISO: "2026-09-02",
    proximoControl: "Hoy",
    saldo: 0,
    riesgoAusencia: 12,
    etiquetas: ["Preventivo"],
    resumenIA:
      "Sin hallazgos relevantes en la última revisión. Buena adherencia a controles semestrales; candidata a plan de mantención anual.",
    timeline: [
      { fecha: "Hoy · 11:00", titulo: "Revisión general", tipo: "control", actual: true },
      { fecha: "02 Sep 2026", titulo: "Destartraje", tipo: "consulta" },
    ],
    waOptIn: false,
  },
  {
    id: "pa4",
    nombre: "Roberto Gómez",
    documento: "28.441.902",
    edad: 42,
    telefono: "+56 9 5510 3320",
    email: "roberto.gomez@mail.com",
    sucursalId: "s1",
    profesionalId: "p1",
    estado: "inactivo",
    ultimaVisita: "12 Oct 2026",
    ultimaVisitaISO: "2026-10-12",
    proximoControl: null,
    saldo: 62000,
    riesgoAusencia: 71,
    etiquetas: ["Ortodoncia", "Riesgo de fuga"],
    resumenIA:
      "Tres inasistencias en los últimos seis meses, todas en horario matinal. Sugerido reagendar en bloque vespertino y activar recordatorio por WhatsApp 24 h antes.",
    timeline: [
      {
        fecha: "Hoy · 13:00",
        titulo: "Control ortodoncia — ausente",
        tipo: "control",
        actual: true,
      },
      {
        fecha: "12 Oct 2026",
        titulo: "Evaluación diagnóstica",
        detalle: "Caries profunda detectada en 1.7.",
        tipo: "consulta",
      },
      { fecha: "04 Sep 2026", titulo: "Limpieza general", tipo: "consulta" },
    ],
    waOptIn: false,
  },
  {
    id: "pa5",
    nombre: "Lucía Méndez",
    documento: "17.220.845",
    edad: 55,
    telefono: "+56 9 9931 2204",
    email: "lucia.mendez@mail.com",
    sucursalId: "s1",
    profesionalId: "p2",
    estado: "activo",
    ultimaVisita: "Hoy",
    ultimaVisitaISO: HOY,
    proximoControl: "20 Dic 2026",
    saldo: 0,
    riesgoAusencia: 5,
    etiquetas: ["Rehabilitación", "Al día"],
    resumenIA:
      "Rehabilitación protésica finalizada. Programar control de oclusión a 60 días y encuesta NPS post tratamiento.",
    timeline: [
      { fecha: "Hoy · 12:00", titulo: "Cementado de corona", tipo: "consulta", actual: true },
      { fecha: "18 Ago 2026", titulo: "Prueba de estructura", tipo: "consulta" },
    ],
    waOptIn: false,
  },
  {
    id: "pa6",
    nombre: "Tomás Arriagada",
    documento: "24.115.667",
    edad: 9,
    telefono: "+56 9 4410 8823",
    email: "familia.arriagada@mail.com",
    sucursalId: "s2",
    profesionalId: "p3",
    estado: "activo",
    ultimaVisita: "Hoy",
    ultimaVisitaISO: HOY,
    proximoControl: "26 Oct 2026",
    saldo: 0,
    riesgoAusencia: 18,
    etiquetas: ["Odontopediatría", "Preventivo"],
    resumenIA:
      "Programa preventivo infantil al día. Sellantes aplicados en molares definitivos; reforzar técnica de cepillado con el apoderado.",
    timeline: [
      { fecha: "Hoy · 10:00", titulo: "Sellantes preventivos", tipo: "consulta", actual: true },
      { fecha: "10 Jul 2026", titulo: "Control semestral", tipo: "control" },
    ],
    waOptIn: false,
  },
  {
    id: "pa7",
    nombre: "Valentina Soto",
    documento: "26.903.114",
    edad: 7,
    telefono: "+56 9 3320 5567",
    email: "soto.familia@mail.com",
    sucursalId: "s2",
    profesionalId: "p3",
    estado: "nuevo",
    ultimaVisita: "Sin visitas",
    ultimaVisitaISO: HOY,
    proximoControl: "Hoy",
    saldo: 0,
    riesgoAusencia: 40,
    etiquetas: ["Paciente nuevo"],
    resumenIA:
      "Primera consulta agendada. Registrar antecedentes médicos del apoderado y evaluar ansiedad dental antes del examen.",
    timeline: [
      { fecha: "Hoy · 12:30", titulo: "Primera consulta infantil", tipo: "consulta", actual: true },
    ],
    waOptIn: false,
  },
  {
    id: "pa8",
    nombre: "Andrés Rivas",
    documento: "15.442.780",
    edad: 61,
    telefono: "+56 9 2218 4471",
    email: "andres.rivas@mail.com",
    sucursalId: "s2",
    profesionalId: "p3",
    estado: "inactivo",
    ultimaVisita: "14 Mar 2026",
    ultimaVisitaISO: "2026-03-14",
    proximoControl: null,
    saldo: 235000,
    riesgoAusencia: 58,
    etiquetas: ["Prótesis", "Saldo pendiente"],
    resumenIA:
      "Plan de prótesis removible pausado hace siete meses con saldo pendiente. Candidato a campaña de reactivación con financiamiento en cuotas.",
    timeline: [
      { fecha: "14 Mar 2026", titulo: "Toma de impresión", tipo: "consulta", actual: true },
      { fecha: "01 Mar 2026", titulo: "Presupuesto emitido", tipo: "presupuesto" },
    ],
    waOptIn: false,
  },
];

export const tratamientos: Tratamiento[] = [
  {
    id: "t1",
    pacienteId: "pa2",
    plan: "Endodoncia + corona 1.7",
    avance: 50,
    profesionalId: "p2",
    sucursalId: "s1",
    estado: "en-curso",
    fecha: "2026-10-12",
  },
  {
    id: "t2",
    pacienteId: "pa4",
    plan: "Ortodoncia fija superior",
    avance: 35,
    profesionalId: "p1",
    sucursalId: "s1",
    estado: "pausado",
    fecha: "2026-06-18",
  },
  {
    id: "t3",
    pacienteId: "pa5",
    plan: "Rehabilitación protésica",
    avance: 100,
    profesionalId: "p2",
    sucursalId: "s1",
    estado: "finalizado",
    fecha: "2026-08-18",
  },
  {
    id: "t4",
    pacienteId: "pa1",
    plan: "Plan preventivo anual",
    avance: 25,
    profesionalId: "p1",
    sucursalId: "s1",
    estado: "en-curso",
    fecha: "2026-10-24",
  },
  {
    id: "t5",
    pacienteId: "pa6",
    plan: "Sellantes + fluoración infantil",
    avance: 70,
    profesionalId: "p3",
    sucursalId: "s2",
    estado: "en-curso",
    fecha: "2026-07-10",
  },
  {
    id: "t6",
    pacienteId: "pa8",
    plan: "Prótesis removible superior",
    avance: 15,
    profesionalId: "p3",
    sucursalId: "s2",
    estado: "pausado",
    fecha: "2026-03-01",
  },
  {
    id: "t7",
    pacienteId: "pa7",
    plan: "Evaluación diagnóstica infantil",
    avance: 0,
    profesionalId: "p3",
    sucursalId: "s2",
    estado: "presupuestado",
    fecha: "2026-10-24",
  },
  {
    id: "t8",
    pacienteId: "pa3",
    plan: "Blanqueamiento y mantención",
    avance: 0,
    profesionalId: "p1",
    sucursalId: "s1",
    estado: "presupuestado",
    fecha: "2026-09-02",
  },
];

export const kpis = [
  { label: "Pacientes hoy", valor: "18", nota: "+12% vs ayer", tono: "success" as const },
  { label: "Ocupación de box", valor: "84%", nota: "Meta: 90%", tono: "neutral" as const },
  { label: "Facturación mes", valor: "$12,4M", nota: "75% del objetivo", tono: "brand" as const },
];

export const etiquetaEstado: Record<EstadoCita, string> = {
  confirmada: "Confirmada",
  "en-sala": "En sala",
  ausente: "Ausente",
  finalizada: "Finalizada",
  tentativa: "Por confirmar",
};

export const etiquetaEstadoPaciente: Record<EstadoPaciente, string> = {
  activo: "Activo",
  nuevo: "Nuevo",
  inactivo: "Inactivo",
};

export const etiquetaEstadoTratamiento: Record<EstadoTratamiento, string> = {
  presupuestado: "Presupuestado",
  "en-curso": "En curso",
  pausado: "Pausado",
  finalizado: "Finalizado",
};

export function getPaciente(id: string) {
  return pacientes.find((p) => p.id === id);
}

export function getProfesional(id: string) {
  return profesionales.find((p) => p.id === id);
}

export function getSucursal(id: string) {
  return sucursales.find((s) => s.id === id);
}

export function formatoMoneda(valor: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(valor);
}

/** Fecha real de hoy (YYYY-MM-DD) en la zona horaria por defecto de la clínica. */
export function hoyISO(timeZone = "America/Santiago"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Guard común: acepta null/undefined/"" y strings mal formados sin explotar. */
function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d!);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatoFecha(iso: string | null | undefined) {
  const date = parseIsoDate(iso);
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatoFechaLarga(iso: string | null | undefined) {
  const date = parseIsoDate(iso);
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}
