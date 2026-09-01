import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT } from "jose";

/**
 * Prueba pura, sin DB: cubre `clinicIdFromExpiredToken`, que extrae el
 * clinic_id de un token del portal VENCIDO (firma válida, solo pasado de
 * `exp`) para poder mostrarle al paciente el WhatsApp real de su clínica en
 * vez de un "contactá a tu clínica" sin ningún dato (auditoría UX, 30-ago).
 * Es lógica de seguridad — nunca debe revelar nada de un token con firma
 * inválida o manipulado, solo de uno que Alika firmó de verdad y expiró.
 */
const SECRET = "test-only-portal-secret-32-bytes-minimum-aaaaaaaa";
const ISSUER = "alika:portal";
const AUDIENCE = "alika:portal:patient";

beforeAll(() => {
  process.env.PORTAL_TOKEN_SECRET = SECRET;
});

async function firmarToken(opts: {
  clinicId?: string;
  patientId?: string;
  expMsAgo?: number;
  issuer?: string;
  audience?: string;
  secret?: string;
}): Promise<string> {
  const {
    clinicId = "11111111-1111-1111-1111-111111111111",
    patientId = "22222222-2222-2222-2222-222222222222",
    expMsAgo,
    issuer = ISSUER,
    audience = AUDIENCE,
    secret = SECRET,
  } = opts;
  let jwt = new SignJWT({ patient_id: patientId, clinic_id: clinicId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt();
  jwt =
    expMsAgo !== undefined
      ? jwt.setExpirationTime(new Date(Date.now() - expMsAgo))
      : jwt.setExpirationTime("7d");
  return jwt.sign(new TextEncoder().encode(secret));
}

describe("clinicIdFromExpiredToken", () => {
  it("token vencido con firma válida: devuelve el clinic_id real", async () => {
    const { clinicIdFromExpiredToken } = await import("../src/lib/portal-token.server");
    const token = await firmarToken({
      clinicId: "33333333-3333-3333-3333-333333333333",
      expMsAgo: 60_000,
    });
    expect(await clinicIdFromExpiredToken(token)).toBe("33333333-3333-3333-3333-333333333333");
  });

  it("token todavía vigente: no es el caso que cubre esta función, devuelve null", async () => {
    const { clinicIdFromExpiredToken } = await import("../src/lib/portal-token.server");
    const token = await firmarToken({});
    expect(await clinicIdFromExpiredToken(token)).toBeNull();
  });

  it("token con firma incorrecta (secret distinto): nunca revela el clinic_id", async () => {
    const { clinicIdFromExpiredToken } = await import("../src/lib/portal-token.server");
    const token = await firmarToken({
      expMsAgo: 60_000,
      secret: "otro-secret-completamente-distinto",
    });
    expect(await clinicIdFromExpiredToken(token)).toBeNull();
  });

  it("token manipulado (basura): no revienta, devuelve null", async () => {
    const { clinicIdFromExpiredToken } = await import("../src/lib/portal-token.server");
    expect(await clinicIdFromExpiredToken("no-es-un-jwt-valido")).toBeNull();
  });

  it("token vencido pero con issuer distinto: no lo acepta como propio", async () => {
    const { clinicIdFromExpiredToken } = await import("../src/lib/portal-token.server");
    const token = await firmarToken({ expMsAgo: 60_000, issuer: "otro:emisor" });
    expect(await clinicIdFromExpiredToken(token)).toBeNull();
  });
});
