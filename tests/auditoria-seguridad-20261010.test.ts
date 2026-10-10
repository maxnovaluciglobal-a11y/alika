import { describe, expect, it } from "vitest";

import { cronAutorizado } from "@/lib/cron-auth.server";
import {
  labTokenRevocado,
  signLabToken,
  verifyLabToken,
} from "@/lib/clinic-operations/lab-portal-token.server";
import { esCuentaDemo } from "@/lib/demo-cuenta";

// Lógica pura de la auditoría de seguridad del 10-oct-2026. Nada de esto
// toca Postgres (el CI corre contra la base de producción).

describe("CRON_SECRET en tiempo constante", () => {
  it("acepta solo el header exacto", () => {
    expect(cronAutorizado("Bearer s3cr3t", "s3cr3t")).toBe(true);
    expect(cronAutorizado("Bearer s3cr3x", "s3cr3t")).toBe(false);
    expect(cronAutorizado("Bearer s3cr3t ", "s3cr3t")).toBe(false);
    expect(cronAutorizado("s3cr3t", "s3cr3t")).toBe(false);
    expect(cronAutorizado(null, "s3cr3t")).toBe(false);
    expect(cronAutorizado("Bearer ", "")).toBe(false);
  });
});

describe("portal de laboratorio", () => {
  it("el token trae su iat y dura 30 días por defecto", async () => {
    const antes = Date.now();
    const token = await signLabToken({ labId: "lab-1", clinicId: "cli-1" });
    const v = await verifyLabToken(token);
    expect(v.labId).toBe("lab-1");
    expect(v.clinicId).toBe("cli-1");
    expect(Math.abs(v.issuedAt.getTime() - antes)).toBeLessThan(5_000);
    const [, payload] = token.split(".");
    const claims = JSON.parse(Buffer.from(payload!, "base64url").toString()) as {
      iat: number;
      exp: number;
    };
    expect(claims.exp - claims.iat).toBe(30 * 24 * 60 * 60);
  });

  it("rechaza laboratorio inexistente, desactivado o revocado después del token", () => {
    const token = { issuedAt: new Date("2026-10-10T12:00:00Z") };
    expect(labTokenRevocado(token, null)).toBe(true);
    expect(labTokenRevocado(token, { is_active: false, portal_revoked_at: null })).toBe(true);
    expect(labTokenRevocado(token, { is_active: true, portal_revoked_at: null })).toBe(false);
    expect(labTokenRevocado(token, { is_active: true })).toBe(false);
    expect(
      labTokenRevocado(token, { is_active: true, portal_revoked_at: "2026-10-11T00:00:00Z" }),
    ).toBe(true);
    // Un link emitido después de revocar vuelve a valer.
    expect(
      labTokenRevocado(token, { is_active: true, portal_revoked_at: "2026-10-09T00:00:00Z" }),
    ).toBe(false);
  });
});

describe("cuenta demo", () => {
  it("se reconoce sin importar mayúsculas ni espacios", () => {
    expect(esCuentaDemo(" Demo@Alika.app ")).toBe(true);
    expect(esCuentaDemo("otra@clinica.cl")).toBe(false);
    expect(esCuentaDemo(null)).toBe(false);
  });
});
