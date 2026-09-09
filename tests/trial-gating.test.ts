import { describe, expect, it } from "vitest";
import {
  debeExpulsarDeLaApp,
  isSubscriptionActive,
  trialDaysLeft,
  trialInformesBloqueados,
  TRIAL_DAYS,
  type Subscription,
} from "@/lib/billing";

const base: Subscription = {
  clinicId: "c1",
  status: "trialing",
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  stripePriceId: null,
  trialEnd: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

const enDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

describe("isSubscriptionActive", () => {
  it("un trial vigente está activo", () => {
    expect(isSubscriptionActive({ ...base, trialEnd: enDias(5) })).toBe(true);
  });

  it("un trial VENCIDO ya no está activo aunque no haya currentPeriodEnd", () => {
    // Bug original: la función sólo miraba currentPeriodEnd, así que un trial
    // con trial_end pasado y current_period_end null nunca vencía.
    expect(isSubscriptionActive({ ...base, trialEnd: enDias(-1) })).toBe(false);
  });

  it("sin suscripción no está activa", () => {
    expect(isSubscriptionActive(null)).toBe(false);
  });

  it("una suscripción activa con período vigente sigue activa", () => {
    expect(isSubscriptionActive({ ...base, status: "active", currentPeriodEnd: enDias(20) })).toBe(
      true,
    );
  });

  it("una cancelada no está activa", () => {
    expect(isSubscriptionActive({ ...base, status: "canceled" })).toBe(false);
  });
});

describe("trialInformesBloqueados", () => {
  it("no bloquea a las clínicas sin fila de suscripción", () => {
    // Las clínicas piloto existentes tienen sub === null y no se tocan.
    expect(trialInformesBloqueados(null)).toBe(false);
  });

  it("no bloquea durante el trial", () => {
    expect(trialInformesBloqueados({ ...base, trialEnd: enDias(3) })).toBe(false);
  });

  it("bloquea cuando el trial venció y no hay tarjeta", () => {
    expect(trialInformesBloqueados({ ...base, trialEnd: enDias(-1) })).toBe(true);
  });

  it("no bloquea si ya puso tarjeta, aunque el trial haya vencido", () => {
    expect(
      trialInformesBloqueados({
        ...base,
        trialEnd: enDias(-1),
        stripeSubscriptionId: "sub_123",
      }),
    ).toBe(false);
  });

  it("no bloquea a una suscripción activa", () => {
    expect(trialInformesBloqueados({ ...base, status: "active" })).toBe(false);
  });
});

describe("trialDaysLeft", () => {
  it("cuenta los días que faltan", () => {
    expect(trialDaysLeft({ ...base, trialEnd: enDias(7) })).toBe(7);
  });

  it("nunca devuelve negativo", () => {
    expect(trialDaysLeft({ ...base, trialEnd: enDias(-5) })).toBe(0);
  });
});

describe("TRIAL_DAYS", () => {
  it("es la única fuente de verdad de la duración", () => {
    expect(TRIAL_DAYS).toBe(14);
  });
});

/**
 * Task 11, fix round 1 — Important #4(b): esta lógica vivía inline en
 * `_clinic/route.tsx::beforeLoad` (`soloTrialVencido = sub != null &&
 * trialInformesBloqueados(sub)`, alimentando `!isSubscriptionActive(sub) &&
 * !soloTrialVencido`) sin ningún test — es la única línea que separa "el
 * trial vence y se activan los informes" de "el trial vence y se cierra la
 * app entera". Extraída a `debeExpulsarDeLaApp` en `billing.ts` para poder
 * testearla acá.
 */
describe("debeExpulsarDeLaApp", () => {
  it("trial vigente no expulsa", () => {
    expect(debeExpulsarDeLaApp({ ...base, trialEnd: enDias(5) })).toBe(false);
  });

  it("trial vencido SIN tarjeta no expulsa — eso lo maneja trialInformesBloqueados puntualmente en los informes, no un redirect de toda la app", () => {
    expect(debeExpulsarDeLaApp({ ...base, trialEnd: enDias(-1) })).toBe(false);
  });

  it("trial vencido CON tarjeta sí expulsa", () => {
    // Estado alcanzable: `createCheckoutSession` (billing.functions.ts) crea
    // la suscripción de Stripe con `trial_period_days: 14` en el momento del
    // checkout, así que `stripeSubscriptionId` queda seteado desde YA, con
    // `status` todavía en "trialing" hasta que Stripe procese el fin del
    // trial. Si `trial_end` pasa antes de que el webhook de Stripe actualice
    // el status (demora normal, o el webhook falla/no está configurado), la
    // fila local queda en este estado exacto: trialing + trial_end vencido +
    // stripeSubscriptionId seteado. Acá `trialInformesBloqueados` ya no
    // bloquea (hay tarjeta), pero `isSubscriptionActive` tampoco lo da por
    // activo (sigue siendo "trialing" con `trial_end` pasado) — no tiene
    // sentido dejarlo con acceso a toda la app basado solo en que alguna vez
    // cargó una tarjeta, así que expulsar es lo correcto acá.
    expect(
      debeExpulsarDeLaApp({ ...base, trialEnd: enDias(-1), stripeSubscriptionId: "sub_123" }),
    ).toBe(true);
  });

  it("past_due expulsa", () => {
    expect(debeExpulsarDeLaApp({ ...base, status: "past_due" })).toBe(true);
  });

  it("canceled expulsa", () => {
    expect(debeExpulsarDeLaApp({ ...base, status: "canceled" })).toBe(true);
  });

  it("unpaid expulsa", () => {
    expect(debeExpulsarDeLaApp({ ...base, status: "unpaid" })).toBe(true);
  });

  it("active con currentPeriodEnd vencido expulsa", () => {
    expect(debeExpulsarDeLaApp({ ...base, status: "active", currentPeriodEnd: enDias(-1) })).toBe(
      true,
    );
  });

  it("active con currentPeriodEnd vigente no expulsa", () => {
    expect(debeExpulsarDeLaApp({ ...base, status: "active", currentPeriodEnd: enDias(20) })).toBe(
      false,
    );
  });

  it("sub === null no expulsa — las clínicas piloto sin fila de suscripción no se tocan", () => {
    expect(debeExpulsarDeLaApp(null)).toBe(false);
  });
});
