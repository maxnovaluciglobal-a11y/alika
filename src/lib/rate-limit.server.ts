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
//
// Algoritmo: ventana deslizante aproximada de "dos cubetas" (no ventana fija,
// no log de timestamps). Pondera el conteo de la ventana anterior por cuánto
// falta de la ventana actual — una ventana fija dejaba pasar hasta 2x el
// límite en el borde entre ventanas (ronda de review 05-sep).

type Bucket = {
  windowStartMs: number;
  windowMs: number;
  currentCount: number;
  previousCount: number;
};

const buckets = new Map<string, Bucket>();

// Techo real del Map: si al insertar seguimos en el tope después de podar
// vencidos, se evicta la entrada más vieja (orden de inserción de Map, que
// no cambia con `.set()` sobre una key existente) en vez de crecer sin fin.
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
  const bucket = advanceBucket(existing, now, config.windowMs);

  if (!existing) reclaimSpaceIfNeeded(now);
  buckets.set(bucketKey, bucket);

  const elapsedInCurrentWindow = now - bucket.windowStartMs;
  const weightOfPreviousWindow = Math.max(0, 1 - elapsedInCurrentWindow / bucket.windowMs);
  const estimated = bucket.previousCount * weightOfPreviousWindow + bucket.currentCount;

  if (estimated > config.max) {
    const retryAfterSeconds = Math.ceil((bucket.windowMs - elapsedInCurrentWindow) / 1000);
    return { limited: true, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }
  return { limited: false, retryAfterSeconds: 0 };
}

function advanceBucket(existing: Bucket | undefined, now: number, windowMs: number): Bucket {
  if (!existing) return { windowStartMs: now, windowMs, currentCount: 1, previousCount: 0 };

  const elapsed = now - existing.windowStartMs;
  if (elapsed >= 2 * windowMs) {
    // Las dos ventanas quedaron atrás — no queda nada que ponderar.
    return { windowStartMs: now, windowMs, currentCount: 1, previousCount: 0 };
  }
  if (elapsed >= windowMs) {
    // Entramos a una ventana nueva: lo que era "actual" pasa a ser "anterior".
    return {
      windowStartMs: existing.windowStartMs + windowMs,
      windowMs,
      currentCount: 1,
      previousCount: existing.currentCount,
    };
  }
  return { ...existing, currentCount: existing.currentCount + 1 };
}

function reclaimSpaceIfNeeded(now: number): void {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartMs >= 2 * bucket.windowMs) buckets.delete(key);
  }
  if (buckets.size >= MAX_TRACKED_KEYS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey !== undefined) buckets.delete(oldestKey);
  }
}

/**
 * IP del cliente detrás del proxy de Vercel. `x-forwarded-for` puede traer
 * una cadena "cliente, proxy1, proxy2" — el primer valor es el más cercano
 * al cliente real. Vercel sobrescribe este header en el edge (no lo pasa tal
 * cual del cliente), así que no es spoofeable desde afuera — dejaría de
 * valer si algún día se mete un proxy propio (Cloudflare, self-host) adelante.
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

// Rutas que reciben webhooks de terceros (Stripe/Meta) — no se limitan por
// IP: ya están protegidas por verificación de firma, y limitarlas arriesga
// descartar eventos reales si el proveedor reintenta o manda varios seguidos
// desde la misma IP. Match EXACTO (no prefijo) — con `startsWith` cualquier
// path que empezara con estos strings (ej. "/api/stripe/webhook-x", que ni
// siquiera es una ruta real) quedaba exento y sin límite (bug real, ronda de
// review 05-sep: un atacante podía mandar tráfico ilimitado a un path
// inexistente que igual consume una invocación serverless).
const RATE_LIMIT_EXEMPT_PATHS = new Set<string>(["/api/stripe/webhook", "/api/whatsapp-webhook"]);

// Generoso a propósito: el uso normal de la app dispara varias llamadas
// _serverFn en paralelo por navegación (ver por ejemplo /pacientes/:id, que
// carga notas + odontograma + presupuestos + pagos + mensajes a la vez).
// El objetivo es cortar scraping/loops de reintento y proteger el costo por
// invocación, no acotar el uso real del staff.
const RATE_LIMIT_RULES: RateLimitConfig[] = [
  { scope: "server-fn", windowMs: 60_000, max: 180 },
  { scope: "public-api", windowMs: 60_000, max: 60 },
];

const RATE_LIMIT_RULE_PREFIXES: Record<string, string> = {
  "server-fn": "/_serverFn/",
  "public-api": "/api/",
};

/**
 * Decide qué regla de rate limit aplica a un pathname, o `null` si no
 * corresponde limitar. Decodifica antes de matchear: h3 (el router debajo de
 * Nitro/TanStack Start) decodifica el pathname para rutear, así que
 * `/%5FserverFn/x` termina ejecutando el server function real aunque el
 * string crudo (`new URL(...).pathname`, sin decodificar) no matchee
 * `/_serverFn/` — sin este paso, ese path evadía el límite por completo
 * (segundo bug real de la ronda de review 05-sep).
 */
export function rateLimitRuleFor(rawPathname: string): RateLimitConfig | null {
  let pathname = rawPathname;
  try {
    pathname = decodeURI(rawPathname);
  } catch {
    // URI malformada: seguir con el string crudo en vez de reventar acá.
  }
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (RATE_LIMIT_EXEMPT_PATHS.has(normalized)) return null;

  return (
    RATE_LIMIT_RULES.find((rule) => normalized.startsWith(RATE_LIMIT_RULE_PREFIXES[rule.scope])) ??
    null
  );
}

// Sólo se resetea a mano en tests — no exportar para uso en app code.
export function __resetRateLimitStateForTests(): void {
  buckets.clear();
}
