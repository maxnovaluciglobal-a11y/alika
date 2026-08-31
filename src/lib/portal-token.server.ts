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

// Generado una vez por proceso — nunca hardcodeado ni committeado. Un valor
// fijo en el repo (como el que había antes) sería un secret público conocido
// que cualquiera podría usar para firmar tokens del portal en cualquier
// deploy que no tenga PORTAL_TOKEN_SECRET seteada. Este fallback solo cubre
// dev local: los tokens no sobreviven un restart del proceso (aceptable,
// nadie depende de un portal link entre reinicios de `npm run dev`).
let devSecret: Uint8Array | null = null;

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
    if (!devSecret) {
      console.warn(
        "[portal-token] Usando secret de desarrollo generado al azar (no persiste entre restarts). Setear PORTAL_TOKEN_SECRET en producción.",
      );
      devSecret = crypto.getRandomValues(new Uint8Array(32));
    }
    return devSecret;
  }

  throw new Error(
    "PORTAL_TOKEN_SECRET no configurada. Setear en Vercel Env Vars (32+ bytes random).",
  );
}

export interface PortalTokenClaims {
  patientId: string;
  clinicId: string;
}

export interface PortalTokenPayload extends PortalTokenClaims {
  issuedAt: Date;
}

/** Firma un JWT con clinic+patient y expiración. */
export async function signPortalToken(
  payload: PortalTokenClaims,
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
  if (!patientId || !clinicId || !payload.iat) {
    throw new Error("Token de portal inválido: faltan claims.");
  }
  return { patientId, clinicId, issuedAt: new Date(payload.iat * 1000) };
}

export const PORTAL_COOKIE_NAME = "alika_portal_session";
export const PORTAL_COOKIE_MAX_AGE_SECONDS = DEFAULT_TTL_DAYS * 24 * 60 * 60;
