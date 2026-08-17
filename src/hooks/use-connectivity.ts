import { useSyncExternalStore } from "react";

export type ConnectivityState = {
  online: boolean;
  /** Última vez que confirmamos alcance real al servidor. null = todavía nunca. */
  lastOnlineAt: number | null;
};

/**
 * Estado de conexión compartido por toda la app.
 *
 * Vive en un módulo y no en un hook porque si cada componente que lo usa
 * armara su propio intervalo, tendríamos N pings en paralelo por la misma
 * pregunta.
 *
 * `navigator.onLine` no alcanza: solo dice si la placa de red está levantada,
 * no si el servidor responde. Un wifi de clínica conectado a un router sin
 * internet reporta `true`. Por eso además probamos alcance real.
 */
const PROBE_URL = "/favicon.ico";
const PROBE_TIMEOUT_MS = 5_000;
const INTERVAL_WHEN_ONLINE_MS = 45_000;
const INTERVAL_WHEN_OFFLINE_MS = 10_000;

// Optimista al arrancar: en SSR no hay red que consultar, y asumir "caído"
// pintaría el banner de sin conexión por un instante en cada carga.
let state: ConnectivityState = { online: true, lastOnlineAt: null };

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let probing = false;

function emit(next: ConnectivityState) {
  if (next.online === state.online && next.lastOnlineAt === state.lastOnlineAt) return;
  state = next;
  for (const l of listeners) l();
}

function markOnline() {
  emit({ online: true, lastOnlineAt: Date.now() });
}

function markOffline() {
  emit({ online: false, lastOnlineAt: state.lastOnlineAt });
}

async function probe() {
  if (probing) return;

  // Si el sistema ya dice que no hay red, no gastamos un request en confirmarlo.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    markOffline();
    return;
  }

  probing = true;
  const controller = new AbortController();
  const abort = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${PROBE_URL}?_probe=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    markOnline();
  } catch {
    markOffline();
  } finally {
    clearTimeout(abort);
    probing = false;
  }
}

function scheduleNext() {
  clearTimeout(timer);
  timer = setTimeout(
    async () => {
      await probe();
      scheduleNext();
    },
    state.online ? INTERVAL_WHEN_ONLINE_MS : INTERVAL_WHEN_OFFLINE_MS,
  );
}

function onFocus() {
  void probe();
}

function start() {
  window.addEventListener("online", onFocus);
  window.addEventListener("offline", markOffline);
  window.addEventListener("focus", onFocus);
  void probe();
  scheduleNext();
}

function stop() {
  window.removeEventListener("online", onFocus);
  window.removeEventListener("offline", markOffline);
  window.removeEventListener("focus", onFocus);
  clearTimeout(timer);
  timer = undefined;
}

function subscribe(listener: () => void) {
  const first = listeners.size === 0;
  listeners.add(listener);
  if (first) start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

const getSnapshot = () => state;

// SSR: siempre el mismo objeto, si no React entra en loop comparando por identidad.
const SERVER_STATE: ConnectivityState = { online: true, lastOnlineAt: null };
const getServerSnapshot = () => SERVER_STATE;

export function useConnectivity() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Motivo para los controles que quedan deshabilitados mientras no hay red. */
export const SIN_CONEXION = "Sin conexión: vuelve a intentarlo cuando regrese internet.";
