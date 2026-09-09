/**
 * Tipos y constantes de billing compartidos entre cliente y servidor.
 * No importa `stripe` acá — es puramente estructural.
 */

export const SUBSCRIPTION_STATUSES = [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  incomplete: "Incompleto",
  incomplete_expired: "Expirado",
  trialing: "Trial",
  active: "Activo",
  past_due: "Pago vencido",
  canceled: "Cancelado",
  unpaid: "No pagado",
  paused: "Pausado",
};

export interface Subscription {
  clinicId: string;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/** Duración del trial. Única fuente de verdad: la migración que crea la fila
 *  y este valor tienen que decir lo mismo. DypOS lo tiene hardcodeado en dos
 *  INSERT distintos. */
export const TRIAL_DAYS = 14;

/** Considerada operativa: el usuario tiene acceso completo al panel. */
export function isSubscriptionActive(sub: Subscription | null): boolean {
  if (!sub) return false;
  if (sub.status !== "trialing" && sub.status !== "active") return false;
  // Un trial con trial_end pasado está vencido aunque currentPeriodEnd sea
  // null: sin esta línea, la fila que crea el trigger nunca expiraría.
  if (sub.status === "trialing" && sub.trialEnd && new Date(sub.trialEnd) <= new Date()) {
    return false;
  }
  if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) <= new Date()) return false;
  return true;
}

/** ¿Se bloquean los INFORMES (finanzas, comisiones, panel, inventario)?
 *  La operación diaria —agenda, pacientes, ficha clínica— nunca se bloquea.
 *  Devuelve false para sub === null: las clínicas piloto anteriores al trigger
 *  siguen con acceso libre y no se tocan. */
export function trialInformesBloqueados(sub: Subscription | null): boolean {
  if (!sub) return false;
  if (sub.status !== "trialing") return false;
  if (sub.stripeSubscriptionId) return false;
  return !!sub.trialEnd && new Date(sub.trialEnd) <= new Date();
}

/** Días restantes de trial (o null si no está en trial). */
export function trialDaysLeft(sub: Subscription | null): number | null {
  if (!sub || sub.status !== "trialing" || !sub.trialEnd) return null;
  const diffMs = new Date(sub.trialEnd).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * ¿Corresponde expulsar al owner de TODA la app hacia `/suscripcion`?
 *
 * Task 11, fix round 1: extraída de `_clinic/route.tsx::beforeLoad`, donde
 * vivía como expresión inline sin ningún test — la única línea que separa
 * "el trial venció y se activan los informes" de "el trial venció y se
 * cierra la app entera". `trialInformesBloqueados(sub) === true` implica
 * siempre `isSubscriptionActive(sub) === false` (un trial vencido sin
 * tarjeta nunca está "activo"), así que restar ese caso de
 * `!isSubscriptionActive(sub)` deja pasar exactamente "trial recién vencido,
 * sin tarjeta" y sigue expulsando en todos los demás casos de post-trial:
 * `past_due`/`canceled`/`unpaid`, o una suscripción `active` cuyo período ya
 * venció.
 */
export function debeExpulsarDeLaApp(sub: Subscription | null): boolean {
  return !!sub && !isSubscriptionActive(sub) && !trialInformesBloqueados(sub);
}
