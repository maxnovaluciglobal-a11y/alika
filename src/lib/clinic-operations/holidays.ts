export interface PublicHoliday {
  /** ISO yyyy-mm-dd */
  date: string;
  /** Nombre local del feriado (ej. "Día de la independencia"). */
  name: string;
}

const NAGER_BASE_URL = "https://date.nager.at/api/v3/PublicHolidays";

/**
 * Cache en memoria por proceso. Nager.Date es un servicio público, gratis y
 * sin API key — no queremos pegarle en cada request de agenda/portal. Los
 * feriados de un país/año no cambian una vez publicados (salvo ajustes
 * rarísimos de última hora), así que un TTL largo es seguro.
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const cache = new Map<string, { expiresAt: number; data: PublicHoliday[] }>();

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
}

/** Trae los feriados públicos de un país/año desde Nager.Date, cacheado en memoria. */
export async function fetchPublicHolidays(
  countryCode: string,
  year: number,
): Promise<PublicHoliday[]> {
  const key = `${countryCode}:${year}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const res = await fetch(`${NAGER_BASE_URL}/${year}/${countryCode}`);

  // Nager.Date devuelve 204 (sin body) cuando no tiene datos para ese país/año.
  if (res.status === 204) {
    const empty: PublicHoliday[] = [];
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data: empty });
    return empty;
  }
  if (!res.ok) throw new Error(`Nager.Date respondió ${res.status} para ${key}`);

  const raw = (await res.json()) as NagerHoliday[];
  const data: PublicHoliday[] = raw.map((h) => ({ date: h.date, name: h.localName || h.name }));
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
  return data;
}
