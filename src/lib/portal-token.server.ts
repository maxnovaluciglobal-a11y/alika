import { SignJWT, jwtVerify } from "jose";

/**
 * Tokens del portal del paciente (Opción C: URL firmada por wa.me, sin
 * login). El paciente recibe `https://alika.com/portal/[token]` por
 * WhatsApp desde la clínica; el server valida el JWT y setea una cookie
 * de sesión por el resto de la navegación.
 *
 * Ventajas vs OTP: cero costo (sin Twilio), cero fricción (no hay que
 * escribir código), LatAm-friendly (todo el mundo tiene WhatsApp).
 * Trade-off: si el paciente reenvía el link, quien lo abra ve sus datos.
 * Mitigación: TTL corto (7 días default) + revocación por rotación de
 * la clave si hace falta.
 */

const DEFAULT_TTL_DAYS = 7;
const ISSUER = "alika:portal";
const AUDIENCE = "alika:portal:patient";

function getSecret(): Uint8Array {
  // Nunca cae a SUPABASE_SERVICE_ROLE_KEY: ese secret abre la DB entera con
  // service_role; reusarlo como HMAC de un token público-facing multiplica
  // su superficie de exposición. Si el portal lo necesita, PORTAL_TOKEN_SECRET
  // se setea explícito (ver docs/PORTAL_SETUP.md).
  const raw = process.env.PORTAL_TOKEN_SECRET;

  if (raw) return new TextEncoder().encode(raw);

  // Último recurso — DEV LOCAL ONLY. Producción DEBE tener
  // PORTAL_TOKEN_SECRET seteado (32+ bytes random).
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[portal-token] Usando secret de desarrollo. Setear PORTAL_TOKEN_SECRET en producción.",
    );
    return new TextEncoder().encode(
      "dev-only-portal-secret-do-not-use-in-production-alika-2026-xxxxxxxx",
    );
  }

  throw new Error(
    "PORTAL_TOKEN_SECRET no configurada. Setear en Vercel Env Vars (32+ bytes random).",
  );
}

export interface PortalTokenPayload {
  patientId: string;
  clinicId: string;
}

/** Firma un JWT con clinic+patient y expiración. */
export async function signPortalToken(
  payload: PortalTokenPayload,
  ttlDays = DEFAULT_TTL_DAYS,
): Promise<string> {
  return await new SignJWT({
    patient_id: payload.patientId,
    clinic_id: payload.clinicId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlDays}d`)
    .sign(getSecret());
}

export async function verifyPortalToken(token: string): Promise<PortalTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  const patientId = payload.patient_id as string | undefined;
  const clinicId = payload.clinic_id as string | undefined;
  if (!patientId || !clinicId) {
    throw new Error("Token de portal inválido: faltan claims.");
  }
  return { patientId, clinicId };
}

export const PORTAL_COOKIE_NAME = "alika_portal_session";
export const PORTAL_COOKIE_MAX_AGE_SECONDS = DEFAULT_TTL_DAYS * 24 * 60 * 60;
