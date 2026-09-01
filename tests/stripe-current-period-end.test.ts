import { describe, expect, it } from "vitest";
import type Stripe from "stripe";

import { extractCurrentPeriodEndIso } from "@/routes/api.stripe.webhook";

/**
 * Regresión del P1 de la auditoría de código 01-sep-2026: con apiVersion
 * "2026-07-29.dahlia" Stripe ya no manda `current_period_end` en el
 * Subscription top-level, solo en cada subscription item. Leerlo del lugar
 * viejo (con un `as unknown` que tapaba el error de tipos) dejaba la fecha
 * de renovación en NULL para toda suscripción real — visible en
 * /suscripcion y en el self-healing check de billing.ts.
 */
function fakeSubscription(itemPeriodEnd: number | undefined): Stripe.Subscription {
  return {
    items: {
      data: itemPeriodEnd === undefined ? [] : [{ current_period_end: itemPeriodEnd }],
    },
  } as unknown as Stripe.Subscription;
}

describe("extractCurrentPeriodEndIso", () => {
  it("lee current_period_end del subscription item, no del top-level", () => {
    const ts = 1_893_456_000; // 2030-01-01T00:00:00Z
    const out = extractCurrentPeriodEndIso(fakeSubscription(ts));
    expect(out).toBe(new Date(ts * 1000).toISOString());
  });

  it("devuelve null si la suscripción no tiene items", () => {
    expect(extractCurrentPeriodEndIso(fakeSubscription(undefined))).toBeNull();
  });
});
