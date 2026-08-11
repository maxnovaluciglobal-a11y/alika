import {
  citas,
  etiquetaEstado,
  etiquetaEstadoTratamiento,
  formatoFecha,
  getPaciente,
  getProfesional,
  pacientes,
  tratamientos,
} from "@/lib/clinic-data";

export const PER_PAGE = 5;

export function normaliza(valor: string) {
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.\-\s]/g, "");
}

export function coincide(termino: string, ...campos: (string | null | undefined)[]) {
  const t = normaliza(termino);
  if (!t) return true;
  return campos.some((c) => (c ? normaliza(c).includes(t) : false));
}

export interface Pagina<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
  desde: number;
  hasta: number;
}

export function paginar<T>(items: T[], page: number, perPage = PER_PAGE): Pagina<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const actual = Math.min(Math.max(1, page), totalPages);
  const inicio = (actual - 1) * perPage;
  return {
    items: items.slice(inicio, inicio + perPage),
    page: actual,
    totalPages,
    total,
    desde: total === 0 ? 0 : inicio + 1,
    hasta: Math.min(inicio + perPage, total),
  };
}

export type GrupoResultado = "Pacientes" | "Citas" | "Tratamientos";

export interface ResultadoGlobal {
  id: string;
  grupo: GrupoResultado;
  titulo: string;
  detalle: string;
  pacienteId: string;
  destino: "pacientes" | "agenda" | "tratamientos";
}

/** Búsqueda global transversal sobre pacientes, citas y tratamientos. */
export function busquedaGlobal(termino: string, limitePorGrupo = 5): ResultadoGlobal[] {
  const t = termino.trim();
  if (!t) return [];

  const resPacientes: ResultadoGlobal[] = pacientes
    .filter((p) => coincide(t, p.nombre, p.documento, p.email, p.telefono, ...p.etiquetas))
    .slice(0, limitePorGrupo)
    .map((p) => ({
      id: `pac-${p.id}`,
      grupo: "Pacientes",
      titulo: p.nombre,
      detalle: `${p.documento} · ${p.etiquetas[0] ?? "Sin etiquetas"}`,
      pacienteId: p.id,
      destino: "pacientes",
    }));

  const resCitas: ResultadoGlobal[] = citas
    .filter((c) => coincide(t, c.paciente, c.tratamiento, getProfesional(c.profesionalId)?.nombre))
    .slice(0, limitePorGrupo)
    .map((c) => ({
      id: `cit-${c.id}`,
      grupo: "Citas",
      titulo: `${c.tratamiento} — ${c.paciente}`,
      detalle: `${formatoFecha(c.fecha)} · ${getProfesional(c.profesionalId)?.nombre ?? ""} · ${etiquetaEstado[c.estado]}`,
      pacienteId: c.pacienteId,
      destino: "agenda",
    }));

  const resTratamientos: ResultadoGlobal[] = tratamientos
    .filter((tr) =>
      coincide(t, tr.plan, getPaciente(tr.pacienteId)?.nombre, getProfesional(tr.profesionalId)?.nombre),
    )
    .slice(0, limitePorGrupo)
    .map((tr) => ({
      id: `tra-${tr.id}`,
      grupo: "Tratamientos",
      titulo: tr.plan,
      detalle: `${getPaciente(tr.pacienteId)?.nombre ?? ""} · ${etiquetaEstadoTratamiento[tr.estado]} · ${tr.avance}%`,
      pacienteId: tr.pacienteId,
      destino: "tratamientos",
    }));

  return [...resPacientes, ...resCitas, ...resTratamientos];
}

/** Helpers de validación de search params (sin dependencias externas). */
export function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export function num(v: unknown, fallback = 1): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
