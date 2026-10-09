/**
 * Lógica pura de "Olvidé mi contraseña" (oct-2026). Vive acá y no en las
 * rutas para poder probarla sin navegador ni Supabase.
 *
 * Flujo: `/auth` pide el enlace con `resetPasswordForEmail` y Supabase manda
 * un correo que vuelve a `/auth/nueva-clave`. Según cómo esté configurado el
 * proyecto, el enlace llega de una de tres formas, y la pantalla acepta las
 * tres para no depender de un ajuste del dashboard:
 *
 * - `#access_token=…&type=recovery` (flujo implícito, el default del cliente
 *   de este repo): supabase-js lo consume solo con `detectSessionInUrl`.
 * - `?code=…` (flujo PKCE): hay que canjearlo con `exchangeCodeForSession`.
 * - `?token_hash=…&type=recovery` (plantilla de correo propia): se valida con
 *   `verifyOtp`. Es la que funciona aunque el enlace se abra en otro navegador.
 *
 * La invitación al equipo usa la misma pantalla con `type=invite`: la persona
 * invitada no tiene contraseña, y sin este paso el enlace le abría la sesión
 * en la landing sin pedirle una.
 */

export const RUTA_NUEVA_CLAVE = "/auth/nueva-clave";

/** Mismo mínimo que el alta de cuenta (`minLength={8}` en `auth.tsx`). */
export const LARGO_MINIMO_CLAVE = 8;

export const MENSAJE_ENLACE_ENVIADO =
  "Si hay una cuenta con ese correo, te enviamos un enlace para crear una contraseña nueva. Revisa también spam.";

export type TipoDeEnlace = "recovery" | "invite";

export type RetornoDeRecuperacion =
  | { tipo: "error"; codigo: string | null }
  | { tipo: "codigo"; code: string }
  | { tipo: "token_hash"; tokenHash: string; otp: TipoDeEnlace }
  | { tipo: "hash" }
  | { tipo: "nada" };

/**
 * Lee lo que dejó el enlace del correo en la URL. Hay que llamarlo ANTES de
 * tocar el cliente de Supabase: al inicializarse consume el hash y lo borra.
 */
export function leerRetornoDeRecuperacion(search: string, hash: string): RetornoDeRecuperacion {
  const q = new URLSearchParams(search.replace(/^\?/, ""));
  const h = new URLSearchParams(hash.replace(/^#/, ""));

  const error = h.get("error") ?? q.get("error");
  const codigoError = h.get("error_code") ?? q.get("error_code");
  if (error || codigoError) return { tipo: "error", codigo: codigoError ?? error };

  const tokenHash = q.get("token_hash");
  const otp = q.get("type") ?? "recovery";
  if (tokenHash && (otp === "recovery" || otp === "invite")) {
    return { tipo: "token_hash", tokenHash, otp };
  }

  const code = q.get("code");
  if (code) return { tipo: "codigo", code };

  if (h.get("access_token") && h.get("type") === "recovery") return { tipo: "hash" };

  return { tipo: "nada" };
}

/**
 * Si Supabase no tiene `/auth/nueva-clave` entre las Redirect URLs, manda el
 * enlace a la Site URL (la landing) con el token en el hash. Ahí la sesión se
 * abriría sin que nadie le pida la contraseña nueva: este chequeo la desvía a
 * la pantalla correcta.
 */
export function debeDesviarANuevaClave(pathname: string, hash: string): boolean {
  if (pathname === RUTA_NUEVA_CLAVE) return false;
  const h = new URLSearchParams(hash.replace(/^#/, ""));
  return h.get("type") === "recovery" && Boolean(h.get("access_token"));
}

/** Validación del formulario de contraseña nueva. `null` si está todo bien. */
export function validarNuevaClave(clave: string, repetida: string): string | null {
  if (clave.length < LARGO_MINIMO_CLAVE) {
    return `La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`;
  }
  if (clave !== repetida) return "Las contraseñas no coinciden.";
  return null;
}

/**
 * El límite por persona de Supabase ("For security purposes, you can only
 * request this after N seconds") solo salta si la cuenta existe. Mostrarlo
 * revelaría que el correo está registrado, así que se trata como envío
 * exitoso: el enlace anterior ya va en camino. El límite general del proyecto
 * sí se informa (mensaje de `mensajeDeError`), porque si no la persona se
 * queda esperando un correo que no sale.
 */
export function esLimitePorCuenta(e: unknown): boolean {
  const m = e instanceof Error ? e.message : "";
  return /for security purposes, you can only request this/i.test(m);
}

/** Mensajes de `updateUser({ password })` que conviene decir en español. */
export function mensajeDeErrorDeClave(e: unknown): string | null {
  const m = e instanceof Error ? e.message : "";
  const code = (e as { code?: unknown } | null)?.code;
  if (code === "same_password" || /different from the old password/i.test(m)) {
    return "La contraseña nueva tiene que ser distinta de la anterior.";
  }
  if (code === "weak_password" || /password should/i.test(m)) {
    return "Esa contraseña es muy débil. Usa una más larga, con letras y números.";
  }
  return null;
}
