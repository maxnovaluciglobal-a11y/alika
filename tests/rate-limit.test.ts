import { describe, expect, it, beforeEach } from "vitest";
import {
  checkRateLimit,
  clientIpFromRequest,
  rateLimitRuleFor,
  __resetRateLimitStateForTests,
} from "@/lib/rate-limit.server";

/**
 * Prueba pura, en memoria: cubre la ventana deslizante (aproximación de dos
 * cubetas) y la detección de IP detrás del proxy de Vercel. No cubre el
 * comportamiento multi-instancia (fuera de alcance — ver el comentario en
 * rate-limit.server.ts).
 */
describe("checkRateLimit", () => {
  beforeEach(() => {
    __resetRateLimitStateForTests();
  });

  it("permite pedidos por debajo del tope", () => {
    const config = { scope: "test", windowMs: 60_000, max: 3 };
    expect(checkRateLimit("ip-a", config).limited).toBe(false);
    expect(checkRateLimit("ip-a", config).limited).toBe(false);
    expect(checkRateLimit("ip-a", config).limited).toBe(false);
  });

  it("bloquea al superar el tope dentro de la ventana", () => {
    const config = { scope: "test", windowMs: 60_000, max: 2 };
    expect(checkRateLimit("ip-b", config).limited).toBe(false);
    expect(checkRateLimit("ip-b", config).limited).toBe(false);
    const third = checkRateLimit("ip-b", config);
    expect(third.limited).toBe(true);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("no comparte contador entre scopes distintos", () => {
    const configA = { scope: "scope-a", windowMs: 60_000, max: 1 };
    const configB = { scope: "scope-b", windowMs: 60_000, max: 1 };
    expect(checkRateLimit("misma-ip", configA).limited).toBe(false);
    expect(checkRateLimit("misma-ip", configB).limited).toBe(false);
  });

  it("no comparte contador entre IPs distintas", () => {
    const config = { scope: "test", windowMs: 60_000, max: 1 };
    expect(checkRateLimit("ip-c", config).limited).toBe(false);
    expect(checkRateLimit("ip-d", config).limited).toBe(false);
  });

  it("resetea el conteo bien pasada la ventana (2x windowMs)", async () => {
    const config = { scope: "test", windowMs: 10, max: 1 };
    expect(checkRateLimit("ip-e", config).limited).toBe(false);
    expect(checkRateLimit("ip-e", config).limited).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(checkRateLimit("ip-e", config).limited).toBe(false);
  });

  it("no deja pasar ~2x el tope en el borde entre ventanas (ventana fija fallaba esto)", async () => {
    // Con ventana FIJA: 5 pedidos justo antes del corte + 5 justo después
    // pasaban los 10, porque cada ventana arranca su propio contador en 0.
    // Con la aproximación de dos cubetas, el conteo de la ventana anterior
    // pondera contra la nueva — no debería dejar pasar 10 pedidos "frescos"
    // apenas cruzado el borde.
    const config = { scope: "burst-test", windowMs: 40, max: 5 };
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("ip-burst", config).limited).toBe(false);
    }
    // Cruzar al borde de la ventana siguiente.
    await new Promise((resolve) => setTimeout(resolve, 41));
    // Si esto fuera una ventana fija, los 5 de acá pasarían igual de gratis.
    // Con el peso de la ventana anterior, algunos de estos deberían bloquear.
    const results = Array.from({ length: 5 }, () => checkRateLimit("ip-burst", config));
    const blockedCount = results.filter((r) => r.limited).length;
    expect(blockedCount).toBeGreaterThan(0);
  });
});

describe("clientIpFromRequest", () => {
  it("usa el primer valor de x-forwarded-for", () => {
    const req = new Request("https://alika.app/api/health", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    });
    expect(clientIpFromRequest(req)).toBe("1.2.3.4");
  });

  it("cae a x-real-ip si no hay x-forwarded-for", () => {
    const req = new Request("https://alika.app/api/health", {
      headers: { "x-real-ip": "5.6.7.8" },
    });
    expect(clientIpFromRequest(req)).toBe("5.6.7.8");
  });

  it("cae a 'unknown' sin ningún header de IP", () => {
    const req = new Request("https://alika.app/api/health");
    expect(clientIpFromRequest(req)).toBe("unknown");
  });
});

/**
 * Cubre los dos bypasses reales encontrados en review (05-sep): la exención
 * de webhooks por `startsWith` dejaba sin límite cualquier path que
 * empezara con el prefijo (ej. "/api/stripe/webhook-bypass"), y el pathname
 * sin decodificar dejaba pasar "/_serverFn/" url-encodeado sin límite aunque
 * h3 sí lo ruteara al handler real.
 */
describe("rateLimitRuleFor", () => {
  it("exime los webhooks reales, match exacto", () => {
    expect(rateLimitRuleFor("/api/stripe/webhook")).toBeNull();
    expect(rateLimitRuleFor("/api/whatsapp-webhook")).toBeNull();
  });

  it("no exime un path que solo empieza igual que un webhook (bug real: startsWith)", () => {
    expect(rateLimitRuleFor("/api/stripe/webhookZZZ")?.scope).toBe("public-api");
    expect(rateLimitRuleFor("/api/stripe/webhook-bypass")?.scope).toBe("public-api");
    expect(rateLimitRuleFor("/api/whatsapp-webhookZZZ")?.scope).toBe("public-api");
  });

  it("sí exime un sub-path real del webhook con trailing slash", () => {
    expect(rateLimitRuleFor("/api/stripe/webhook/")).toBeNull();
  });

  it("limita un webhook con un segmento extra en la ruta (no es el path exacto)", () => {
    expect(rateLimitRuleFor("/api/stripe/webhook/algo-mas")?.scope).toBe("public-api");
  });

  it("decodifica antes de matchear _serverFn (bug real: %5F sin decodificar evadía el límite)", () => {
    expect(rateLimitRuleFor("/%5FserverFn/algunHandler")?.scope).toBe("server-fn");
  });

  it("decodifica antes de matchear un webhook encodeado, sigue exento", () => {
    expect(rateLimitRuleFor("/api/stripe/webho%6Fk")).toBeNull();
  });

  it("matchea /api/ genérico", () => {
    expect(rateLimitRuleFor("/api/health")?.scope).toBe("public-api");
    expect(rateLimitRuleFor("/api/demo-reset")?.scope).toBe("public-api");
  });

  it("no limita rutas de la app normal", () => {
    expect(rateLimitRuleFor("/pacientes/123")).toBeNull();
    expect(rateLimitRuleFor("/")).toBeNull();
  });

  it("no revienta con una secuencia %-encoding inválida", () => {
    expect(() => rateLimitRuleFor("/api/%")).not.toThrow();
    expect(rateLimitRuleFor("/api/%")?.scope).toBe("public-api");
  });
});
