/**
 * Helpers de fecha civiles (YYYY-MM-DD) para las vistas de agenda.
 * Se trabaja en UTC a propósito: `Cita.fecha` ya viene como fecha local de la
 * sucursal calculada server-side, así que acá es solo aritmética de calendario
 * sin timezone (evita corrimientos por DST del runtime).
 */

function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDaysISO(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}
export function addMonthsISO(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setUTCMonth(d.getUTCMonth() + n);
  return toISO(d);
}
/** Lunes de la semana que contiene `iso`. */
function weekStartISO(iso: string): string {
  const d = parseISO(iso);
  const day = d.getUTCDay(); // 0=domingo … 6=sábado
  const offset = (day + 6) % 7; // días desde el lunes
  d.setUTCDate(d.getUTCDate() - offset);
  return toISO(d);
}
export function weekDaysISO(iso: string): string[] {
  const start = weekStartISO(iso);
  return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
}
/** 42 días (6 semanas L→D) que cubren el mes de `iso`. */
export function monthGridISO(iso: string): string[] {
  const d = parseISO(iso);
  d.setUTCDate(1);
  const first = weekStartISO(toISO(d));
  return Array.from({ length: 42 }, (_, i) => addDaysISO(first, i));
}
export function rangoDeVista(vista: "dia" | "semana" | "mes", fecha: string): [string, string] {
  if (vista === "semana") {
    const dias = weekDaysISO(fecha);
    return [dias[0], dias[6]];
  }
  if (vista === "mes") {
    const d = parseISO(fecha);
    d.setUTCDate(1);
    const primero = toISO(d);
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(0);
    return [primero, toISO(d)];
  }
  return [fecha, fecha];
}
export function nroDiaISO(iso: string): number {
  return parseISO(iso).getUTCDate();
}
export function esMismoMesISO(iso: string, ref: string): boolean {
  return iso.slice(0, 7) === ref.slice(0, 7);
}
