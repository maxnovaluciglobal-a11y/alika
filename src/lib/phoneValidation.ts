// src/lib/phoneValidation.ts
// Valida teléfonos contra Numverify — confirma que el número tiene forma
// real (país, operador), no que el paciente sea contactable de verdad.
// Informativo únicamente: nunca bloquea alta ni edición de un paciente, la
// cobertura de Numverify para operadores regionales chicos de LatAm no es
// perfecta y un falso negativo bloqueando una ficha real sería peor que no
// validar nada.
//
// A diferencia de holidays.ts (cache en memoria, TTL corto, dato público),
// acá el resultado se guarda directo en patients.phone_valid — el propio
// registro del paciente ES el cache, no hace falta uno separado. Solo se
// vuelve a llamar a Numverify cuando el teléfono realmente cambia (ver
// patients.functions.ts).
//
// Server-only: NUMVERIFY_API_KEY no tiene prefijo VITE_, nunca llega al
// cliente (ver DEPLOY-VERCEL.md, sección "cliente vs servidor").

/**
 * true/false si Numverify pudo validar la forma del número, null si no se
 * pudo determinar (sin key, timeout, error, o el campo vino vacío). Nunca
 * lanza — un fallo acá nunca debe romper el alta/edición de un paciente.
 */
export async function validatePhoneNumber(
  phone: string | null | undefined,
): Promise<boolean | null> {
  const trimmed = (phone ?? "").trim();
  if (!trimmed) return null;

  const apiKey = process.env.NUMVERIFY_API_KEY;
  if (!apiKey) return null;

  try {
    // Free tier de Numverify es HTTP, no HTTPS.
    const url = `http://apilayer.net/api/validate?access_key=${encodeURIComponent(apiKey)}&number=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const json = await res.json();

    if (!res.ok || json.error || typeof json.valid !== "boolean") {
      if (json.error)
        console.error("[phoneValidation] Numverify error:", json.error.info ?? json.error);
      return null;
    }
    return json.valid as boolean;
  } catch (err) {
    console.error("[phoneValidation] fetch error:", err instanceof Error ? err.message : err);
    return null;
  }
}
