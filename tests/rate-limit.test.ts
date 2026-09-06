import { describe, expect, it, beforeEach } from "vitest";
import {
  checkRateLimit,
  clientIpFromRequest,
  __resetRateLimitStateForTests,
} from "@/lib/rate-limit.server";

/**
 * Prueba pura, en memoria: cubre la ventana deslizante y la detección de IP
 * detrás del proxy de Vercel. No cubre el comportamiento multi-instancia
 * (fuera de alcance — ver el comentario en rate-limit.server.ts).
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

  it("resetea la ventana pasado el tiempo configurado", async () => {
    const config = { scope: "test", windowMs: 10, max: 1 };
    expect(checkRateLimit("ip-e", config).limited).toBe(false);
    expect(checkRateLimit("ip-e", config).limited).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(checkRateLimit("ip-e", config).limited).toBe(false);
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
