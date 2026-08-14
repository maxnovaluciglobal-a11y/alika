import { CLINIC_ROLES, type ClinicRole } from "@/lib/access";

const STORAGE_KEY = "alika:sim-role";

/** Roles reales que pueden activar el modo de simulación. */
export const SIMULATION_ALLOWED_ROLES: ClinicRole[] = ["owner", "admin"];

export function puedeSimular(role: ClinicRole | null | undefined) {
  return !!role && SIMULATION_ALLOWED_ROLES.includes(role);
}

/** Rol simulado guardado en el navegador (solo afecta la interfaz, nunca la base de datos). */
export function leerRolSimulado(): ClinicRole | null {
  if (typeof window === "undefined") return null;
  const valor = window.localStorage.getItem(STORAGE_KEY);
  return (CLINIC_ROLES as readonly string[]).includes(valor ?? "") ? (valor as ClinicRole) : null;
}

export function guardarRolSimulado(role: ClinicRole | null) {
  if (typeof window === "undefined") return;
  if (role) window.localStorage.setItem(STORAGE_KEY, role);
  else window.localStorage.removeItem(STORAGE_KEY);
}
