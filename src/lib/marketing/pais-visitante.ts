// src/lib/marketing/pais-visitante.ts
//
// País probable del visitante, deducido de la zona horaria del navegador.
// Sirve para dos cosas de marketing y nada más: el `countryCode` de los leads
// (antes /demo mandaba "CL" fijo y contaminaba el origen) y la moneda con la
// que arrancan los precios y la calculadora de la landing. No es dato de la
// clínica: la moneda real de una clínica sale de `clinics.currency`.
//
// Zona horaria y no `navigator.language`: muchos navegadores de LatAm vienen
// en "es-ES" o "en-US", pero el reloj del sistema casi siempre está bien.

import type { PaisCaptacion } from "@/lib/marketing/leads";
import type { MonedaPrecio } from "@/lib/pricing-display";

/** País por defecto cuando la zona no corresponde a ningún mercado objetivo. */
export const PAIS_POR_DEFECTO: PaisCaptacion = "CL";

const ZONAS_EXACTAS: Record<string, PaisCaptacion> = {
  "America/Lima": "PE",
  "America/Santiago": "CL",
  "America/Punta_Arenas": "CL",
  "Pacific/Easter": "CL",
  "Chile/Continental": "CL",
  "America/Bogota": "CO",
  "America/Mexico_City": "MX",
  "America/Cancun": "MX",
  "America/Merida": "MX",
  "America/Monterrey": "MX",
  "America/Matamoros": "MX",
  "America/Chihuahua": "MX",
  "America/Ciudad_Juarez": "MX",
  "America/Ojinaga": "MX",
  "America/Mazatlan": "MX",
  "America/Bahia_Banderas": "MX",
  "America/Hermosillo": "MX",
  "America/Tijuana": "MX",
  "America/Ensenada": "MX",
  "Mexico/General": "MX",
  "America/Buenos_Aires": "AR",
  "America/Cordoba": "AR",
  "America/Catamarca": "AR",
  "America/Jujuy": "AR",
  "America/Mendoza": "AR",
  "America/Rosario": "AR",
};

/** País a partir de un identificador IANA. Fallback: Chile. */
export function paisPorZonaHoraria(zona: string | null | undefined): PaisCaptacion {
  if (!zona) return PAIS_POR_DEFECTO;
  const exacta = ZONAS_EXACTAS[zona];
  if (exacta) return exacta;
  if (zona.startsWith("America/Argentina/")) return "AR";
  return PAIS_POR_DEFECTO;
}

/** País del visitante según su navegador. Solo en cliente: en SSR devuelve
 *  el default, así que llamarlo dentro de un `useEffect`. */
export function detectarPaisVisitante(): PaisCaptacion {
  try {
    return paisPorZonaHoraria(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return PAIS_POR_DEFECTO;
  }
}

/**
 * Moneda con la que arrancan precios y calculadora de la landing. Argentina
 * va en USD: no hay un tipo de cambio de referencia para ARS que se pueda
 * mantener a mano con alguna honestidad, y el cobro igual es en dólares.
 */
export function monedaPorPais(pais: PaisCaptacion): MonedaPrecio {
  switch (pais) {
    case "CL":
      return "CLP";
    case "PE":
      return "PEN";
    case "MX":
      return "MXN";
    case "CO":
      return "COP";
    case "AR":
      return "USD";
  }
}
