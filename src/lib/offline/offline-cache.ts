import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/react-query-persist-client";
import type { Query, QueryClient } from "@tanstack/react-query";
import { clear, createStore, get, set } from "idb-keyval";

const DB_NAME = "alika-offline";
const STORE_NAME = "react-query";
const CACHE_KEY = "cache";
const OWNER_KEY = "owner";

/** Una semana. Pasado eso el cache se descarta aunque nadie haya cerrado sesión. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Qué se guarda en el disco del equipo, por prefijo de query key.
 *
 * Es una lista blanca a propósito: lo que no está acá NO se persiste. El
 * criterio es "lo mínimo para que recepción pueda ver el día y encontrar a
 * un paciente durante un corte".
 *
 * Deliberadamente FUERA (quedan solo en memoria, se pierden al recargar):
 * `clinical-notes`, `odontogram-marks`, `odontogram-history` — la PHI más
 * sensible; `payments`, `quotes`, `finance-summary`, `treatment-plans` —
 * detalle financiero; `messages`, `compliance-log` — historial de contacto
 * y auditoría. Ninguno de esos hace falta para atender el mostrador, y
 * dejarlos en disco agranda el daño si roban el equipo.
 */
const PERSISTIBLE_KEY_PREFIXES = new Set([
  // Quién soy y en qué clínica. Sin esto ninguna pantalla abre, y no contiene
  // datos de pacientes: es el usuario, su rol y la clínica a la que pertenece.
  "my-access",
  "appointments",
  "appointment-requests",
  "patients",
  "patient",
  "professionals",
  "branches",
  "procedures",
  "waitlist",
  "my-clinics",
  "public-holidays",
]);

function idbStore() {
  return createStore(DB_NAME, STORE_NAME);
}

export async function purgeOfflineCache() {
  try {
    await clear(idbStore());
  } catch {
    // IndexedDB puede no estar disponible (modo privado, storage lleno).
    // No es motivo para romper el logout.
  }
}

function shouldPersistQuery(query: Query) {
  const prefix = query.queryKey[0];
  return typeof prefix === "string" && PERSISTIBLE_KEY_PREFIXES.has(prefix);
}

/**
 * Persister sobre IndexedDB con guardia de dueño.
 *
 * En una PC compartida el cache queda del usuario que lo escribió: si al
 * restaurar el dueño no coincide con la sesión actual, se descarta entero en
 * vez de mostrarle datos de un colega al siguiente que entra.
 */
function createPersister(userId: string) {
  const store = idbStore();
  const base = createAsyncStoragePersister({
    storage: {
      getItem: (key: string) => get<string>(key, store).then((v) => v ?? null),
      setItem: (key: string, value: string) => set(key, value, store),
      removeItem: () => purgeOfflineCache(),
    },
    key: CACHE_KEY,
    throttleTime: 2_000,
  });

  return {
    persistClient: async (client: Parameters<typeof base.persistClient>[0]) => {
      await set(OWNER_KEY, userId, store);
      await base.persistClient(client);
    },
    restoreClient: async () => {
      const owner = await get<string>(OWNER_KEY, store);
      if (owner !== userId) {
        await purgeOfflineCache();
        return undefined;
      }
      return base.restoreClient();
    },
    removeClient: purgeOfflineCache,
  } satisfies typeof base;
}

/**
 * Restauración: idempotente y cacheada por usuario.
 *
 * Se llama desde el guard de ruta (no desde un efecto de React) porque en un
 * arranque en frío sin conexión, `beforeLoad` corre ANTES del primer render:
 * si el cache no está cargado para entonces, el guard no encuentra al usuario
 * y la app se cae al login. Con el service worker eso dejó de ser hipotético.
 */
let hydration: { userId: string; promise: Promise<void> } | undefined;

export function ensureOfflineCacheHydrated(queryClient: QueryClient, userId: string) {
  if (typeof window === "undefined") return Promise.resolve();
  if (hydration?.userId === userId) return hydration.promise;

  const promise = persistQueryClientRestore({
    queryClient,
    persister: createPersister(userId),
    maxAge: MAX_AGE_MS,
  }).catch(() => {
    // Cache corrupto o IndexedDB bloqueado: se arranca sin nada guardado,
    // que es exactamente el comportamiento previo a esto.
  });

  hydration = { userId, promise };
  return promise;
}

/**
 * Guardado continuo. Devuelve una función para desconectar.
 * La restauración ya la hizo `ensureOfflineCacheHydrated` en el guard.
 */
export function attachOfflineCache(queryClient: QueryClient, userId: string) {
  // Sin `maxAge` acá a propósito: la caducidad se evalúa al restaurar
  // (`persistQueryClientRestore`), no al guardar.
  return persistQueryClientSubscribe({
    queryClient,
    persister: createPersister(userId),
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
  });
}

/** Se llama al cerrar sesión: el próximo usuario no hereda nada. */
export function resetOfflineCache() {
  hydration = undefined;
  return purgeOfflineCache();
}
