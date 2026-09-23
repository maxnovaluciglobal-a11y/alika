import { SignJWT, jwtVerify } from "jose";

/**
 * Tokens del portal externo de laboratorio — mismo patrón que
 * `patients/portal-token.server.ts` (Opción C: URL firmada, sin login),
 * pero para que un laboratorio externo vea y actualice el estado de sus
 * propias órdenes sin tener cuenta de staff en Alika.
 *
 * Issuer/audience/cookie propios (distintos del portal de paciente) para
 * que un token de un tipo nunca sea válido para el otro, aunque compartan
 * el mismo `PORTAL_TOKEN_SECRET`.
 */

const DEFAULT_TTL_DAYS = 90;
const ISSUER = "alika:lab-portal";
const AUDIENCE = "alika:lab-portal:lab";

let devSecret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  const raw = process.env.PORTAL_TOKEN_SECRET;
  if (raw) return new TextEncoder().encode(raw);
  if (process.env.NODE_ENV !== "production") {
    if (!devSecret) devSecret = crypto.getRandomValues(new Uint8Array(32));
    return devSecret;
  }
  throw new Error("PORTAL_TOKEN_SECRET no configurada.");
}

export interface LabTokenClaims {
  labId: string;
  clinicId: string;
}

export async function signLabToken(
  payload: LabTokenClaims,
  ttlDays = DEFAULT_TTL_DAYS,
): Promise<string> {
  return await new SignJWT({ lab_id: payload.labId, clinic_id: payload.clinicId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlDays}d`)
    .sign(getSecret());
}

export async function verifyLabToken(token: string): Promise<LabTokenClaims> {
  const { payload } = await jwtVerify(token, getSecret(), { issuer: ISSUER, audience: AUDIENCE });
  const labId = payload.lab_id as string | undefined;
  const clinicId = payload.clinic_id as string | undefined;
  if (!labId || !clinicId) throw new Error("Token de laboratorio inválido.");
  return { labId, clinicId };
}

export const LAB_PORTAL_COOKIE_NAME = "alika_lab_portal_session";
export const LAB_PORTAL_COOKIE_MAX_AGE_SECONDS = DEFAULT_TTL_DAYS * 24 * 60 * 60;
