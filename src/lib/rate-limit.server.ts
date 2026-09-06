// Rate limiter de red, en memoria, por instancia de función serverless.
//
// Limitación conocida: Vercel puede correr múltiples instancias en paralelo
// (por región/escala), así que el tope real bajo carga alta es
// `LIMITE * instancias_activas`, no `LIMITE` a secas. Para un tope exacto y
// compartido entre instancias hace falta un store externo (Upstash Redis /
// Vercel KV) — decisión de infraestructura nueva que no se tomó acá. Esto
// igual corta abuso de un mismo origen (scraping, loops de reintento, bots)
// y protege el costo por invocación de Vercel/Supabase, que es el riesgo
// que motivó el hallazgo (ver PLAN_REMEDIACION_TECNICA_CARLOS_ALIKA.md).
//
// No se aplica a los webhooks (`api.stripe.webhook`, `api.whatsapp-webhook`):
// ya están protegidos por verificación de firma, y un límite por IP ahí
// arriesga descartar eventos legítimos si Stripe/Meta reintenta o manda
// varios eventos seguidos desde la misma IP.

type Bucket = {
  count: number;
  windowStartMs: number;
};

const buckets = new Map<string, Bucket>();

// Poda oportunista para no crecer sin límite en una instancia de larga vida.
const MAX_TRACKED_KEYS = 5000;

export type RateLimitConfig = {
  /** Prefijo lógico para no compartir contador entre distintos límites. */
  scope: string;
  windowMs: number;
  max: number;
};

export type RateLimitResult = {
  limited: boolean;
  retryAfterSeconds: number;
};

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const bucketKey = `${config.scope}:${key}`;
  const existing = buckets.get(bucketKey);

  if (!existing || now - existing.windowStartMs >= config.windowMs) {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      pruneExpired(now, config.windowMs);
    }
    buckets.set(bucketKey, { count: 1, windowStartMs: now });
    return { limited: false, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > config.max) {
    const retryAfterSeconds = Math.ceil((existing.windowStartMs + config.windowMs - now) / 1000);
    return { limited: true, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }

  return { limited: false, retryAfterSeconds: 0 };
}

function pruneExpired(now: number, windowMs: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartMs >= windowMs) buckets.delete(key);
  }
}

/**
 * IP del cliente detrás del proxy de Vercel. `x-forwarded-for` puede traer
 * una cadena "cliente, proxy1, proxy2" — el primer valor es el más cercano
 * al cliente real.
 */
export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  // Sin IP identificable (dev local, o header ausente): un bucket compartido
  // es mejor que reventar, pero no aísla abuso — no debería pasar en Vercel.
  return "unknown";
}

// Sólo se resetea a mano en tests — no exportar para uso en app code.
export function __resetRateLimitStateForTests(): void {
  buckets.clear();
}
