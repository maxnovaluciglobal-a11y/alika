import {
  HOY,
  citas,
  getPaciente,
  getProfesional,
  getSucursal,
  profesionales,
  sucursales,
  tratamientos,
} from "@/lib/clinic-data";

/** Paciente autenticado en el portal (prototipo). */
export const PACIENTE_PORTAL_ID = "pa1";

export function pacientePortal() {
  return getPaciente(PACIENTE_PORTAL_ID)!;
}

export interface ReservaPortal {
  id: string;
  fecha: string;
  hora: string;
  motivo: string;
  profesionalId: string;
  sucursalId: string;
  creadaEn: string;
}

export type EstadoDocumento = "enviado" | "en-revision" | "aprobado";

export interface DocumentoPortal {
  id: string;
  nombre: string;
  tipo: string;
  tamano: string;
  estado: EstadoDocumento;
  fecha: string;
}

export const motivosConsulta = [
  "Control periódico",
  "Limpieza / profilaxis",
  "Dolor o urgencia",
  "Continuar tratamiento",
  "Evaluación de ortodoncia",
  "Blanqueamiento",
];

export const tiposDocumento = [
  "Radiografía externa",
  "Orden médica",
  "Examen de laboratorio",
  "Credencial de seguro",
  "Consentimiento firmado",
  "Otro",
];

export const etiquetaEstadoDocumento: Record<EstadoDocumento, string> = {
  enviado: "Enviado",
  "en-revision": "En revisión",
  aprobado: "Aprobado",
};

export const documentosIniciales: DocumentoPortal[] = [
  {
    id: "d1",
    nombre: "Radiografia-panoramica.jpg",
    tipo: "Radiografía externa",
    tamano: "2.4 MB",
    estado: "aprobado",
    fecha: "2026-09-30",
  },
  {
    id: "d2",
    nombre: "Credencial-isapre.pdf",
    tipo: "Credencial de seguro",
    tamano: "310 KB",
    estado: "en-revision",
    fecha: "2026-10-18",
  },
];

/** Sucursales y profesionales disponibles para reservar. */
export const sucursalesPortal = sucursales;

export function profesionalesDeSucursal(sucursalId: string) {
  return profesionales.filter((p) => p.sucursalId === sucursalId);
}

function sumarDias(iso: string, dias: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(y!, (m ?? 1) - 1, d! + dias);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

/** Próximos 14 días hábiles a partir de mañana. */
export function diasDisponibles(cantidad = 14) {
  const dias: string[] = [];
  let offset = 1;
  while (dias.length < cantidad) {
    const iso = sumarDias(HOY, offset);
    const [y, m, d] = iso.split("-").map(Number);
    const dow = new Date(y!, (m ?? 1) - 1, d!).getDay();
    if (dow !== 0) dias.push(iso);
    offset += 1;
  }
  return dias;
}

const HORAS_BASE = ["09:00", "09:45", "10:30", "11:15", "12:00", "15:00", "15:45", "16:30", "17:15", "18:00"];

/** Horas libres simuladas para un profesional en una fecha. */
export function horasDisponibles(fecha: string, profesionalId: string) {
  const semilla = (fecha + profesionalId).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return HORAS_BASE.filter((_, i) => (semilla + i * 7) % 3 !== 0);
}

export function citasDelPaciente(pacienteId = PACIENTE_PORTAL_ID) {
  return citas
    .filter((c) => c.pacienteId === pacienteId)
    .map((c) => ({
      ...c,
      hora: `${String(Math.floor(8 + c.inicio / 60)).padStart(2, "0")}:${String(c.inicio % 60).padStart(2, "0")}`,
    }));
}

export function tratamientosDelPaciente(pacienteId = PACIENTE_PORTAL_ID) {
  return tratamientos.filter((t) => t.pacienteId === pacienteId);
}

export function nombreProfesional(id: string) {
  return getProfesional(id)?.nombre ?? "Equipo Oralia";
}

export function nombreSucursal(id: string) {
  return getSucursal(id)?.nombre ?? "Oralia";
}

export function formatoFechaCorta(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(y!, (m ?? 1) - 1, d!),
  );
}
