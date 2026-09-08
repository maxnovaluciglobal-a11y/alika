import { describe, expect, it } from "vitest";
import {
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
