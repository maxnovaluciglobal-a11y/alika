import { createCipheriv, createDecipheriv, randomBytes, randomInt } from "node:crypto";

// Credenciales de WhatsApp por clínica: el token de negocio que entrega Meta
// al terminar el Embedded Signup y el PIN de verificación en dos pasos del
// número. Se guardan cifrados (AES-256-GCM) en public.whatsapp_credentials,
// una tabla sin políticas RLS: solo la lee el service role desde el servidor.
// La clave vive en WHATSAPP_CREDENTIALS_KEY (32 bytes en base64), nunca en
// la base: con un dump de la base sola no se puede usar ningún token.

const ALGORITMO = "aes-256-gcm";

function clave(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.WHATSAPP_CREDENTIALS_KEY;
  if (!raw) throw new Error("Falta WHATSAPP_CREDENTIALS_KEY en el servidor.");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("WHATSAPP_CREDENTIALS_KEY tiene que medir 32 bytes.");
  return buf;
}

/** "v1.<iv>.<tag>.<cifrado>" en base64url. */
export function cifrarCredencial(texto: string, env?: NodeJS.ProcessEnv): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITMO, clave(env), iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv, tag, cifrado]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

export function descifrarCredencial(valor: string, env?: NodeJS.ProcessEnv): string {
  const [version, iv, tag, cifrado] = valor.split(".");
  if (version !== "v1" || !iv || !tag || !cifrado)
    throw new Error("Credencial con formato desconocido.");
  const decipher = createDecipheriv(ALGORITMO, clave(env), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(cifrado, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** PIN de 6 dígitos para la verificación en dos pasos del número. */
export function nuevoPinWhatsApp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
