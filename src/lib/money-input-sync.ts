import { fromCents, toCents } from "@/lib/finance";

/**
 * Lógica de sincronización de `MoneyInput`, separada del componente para
 * poder probarla: es la parte que puede romperse en silencio y el repo no
 * tiene infraestructura para montar componentes.
 */

/** "" → null (sin dato, regla 11). Texto inválido → null, nunca NaN. */
export function textoACents(texto: string, currency: string): number | null {
  if (texto.trim() === "") return null;
  const n = Number(texto);
  return Number.isFinite(n) ? toCents(n, currency) : null;
}

export function centsATexto(cents: number | null, currency: string): string {
  return cents == null ? "" : String(fromCents(cents, currency));
}

/**
 * Qué texto tiene que mostrar el input cuando el valor de afuera cambió.
 *
 * Devolver `null` significa "no toques lo que el usuario está escribiendo".
 * Esa es la regla que hace tipeable el punto decimal: "45." y "45" valen los
 * mismos cents, así que reescribir el texto solo porque el round-trip lo
 * normaliza le borraría el punto al usuario en cuanto lo escribe.
 */
export function textoSincronizado(
  textoActual: string,
  valueCents: number | null,
  currency: string,
): string | null {
  if (valueCents === textoACents(textoActual, currency)) return null;
  return centsATexto(valueCents, currency);
}
