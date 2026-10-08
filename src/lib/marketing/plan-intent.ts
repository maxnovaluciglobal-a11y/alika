// src/lib/marketing/plan-intent.ts
//
// "Comprar ahora" desde el landing: Esmalia es trial-first (registrate gratis →
// 14 días → recién ahí el gate te manda a /suscripcion), así que no existe un
// checkout público sin cuenta — `createCheckoutSession` necesita un
// `clinicId` real (ver `billing.functions.ts`). El atajo que sí se puede dar
// sin tocar ese modelo es recordar la intención de compra a través de
// signup → onboarding (crea la clínica) → suscripcion (dispara el checkout
// que ya existe), en vez de soltar al usuario en /dashboard sin más.
//
// sessionStorage y no un query param: sobrevive el hash de la vuelta de
// Google OAuth a `/auth` (que sí perdería cualquier `?plan=` propio) y no
// hace falta threadearlo a mano por cada redirect intermedio.
const KEY = "alika_plan_intent";

export type PlanIntent = "solo" | "clinica";

function esPlanValido(v: unknown): v is PlanIntent {
  return v === "solo" || v === "clinica";
}

export function setPlanIntent(plan: PlanIntent) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, plan);
  } catch {
    // Storage bloqueado (modo privado, etc.) — el CTA sigue funcionando,
    // simplemente no se recuerda el plan elegido más allá del click.
  }
}

/** Lee sin borrar — para decidir a dónde redirigir sin gastar la intención
 *  todavía (puede hacer falta más de un salto: auth → onboarding → suscripción). */
export function peekPlanIntent(): PlanIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.sessionStorage.getItem(KEY);
    return esPlanValido(v) ? v : null;
  } catch {
    return null;
  }
}

/** Lee y borra — usar en el último salto de la cadena (suscripcion.tsx),
 *  para no re-disparar el checkout automático en cada visita futura. */
export function consumePlanIntent(): PlanIntent | null {
  const v = peekPlanIntent();
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(KEY);
    } catch {
      // no-op
    }
  }
  return v;
}
