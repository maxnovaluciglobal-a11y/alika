import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
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

/**
 * userId dueño del cache actual. Lo setea el listener de auth en __root.
 * Vive en un módulo (y no en React) porque el persister lo necesita fuera
 * del árbol de componentes, en cada escritura.
 */
let currentUserId: string | undefined;

export function setCacheOwner(userId: string | undefined) {
  currentUserId = userId;
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
 * Conecta la persistencia del cache de React Query a IndexedDB.
 *
 * Solo corre en el browser — el caller es responsable de no invocarlo
 * durante SSR (ahí no existe IndexedDB y `getRouter()` crea un QueryClient
 * distinto por request).
 *
 * En una PC compartida el cache queda del usuario que lo escribió: si al
 * restaurar el dueño no coincide con la sesión actual, se descarta entero
 * en vez de mostrarle datos de un colega al siguiente que entra.
 *
 * Devuelve una función para desconectar.
 *
 * NOTA (Tanda 1): la restauración no bloquea el primer render, así que una
 * query puede dispararse antes de que el cache esté cargado. No importa
 * mientras el escenario sea "la app ya está abierta y se cae la red" (ahí
 * alcanza el cache en memoria). Cuando entre el service worker y se pueda
 * abrir la app sin conexión, hay que pasar a `PersistQueryClientProvider`
 * para que espere la restauración antes de pintar.
 */
export function attachOfflineCache(queryClient: QueryClient, userId: string) {
  const store = idbStore();
  const storage = {
    getItem: (key: string) => get<string>(key, store).then((v) => v ?? null),
    setItem: (key: string, value: string) => set(key, value, store),
    removeItem: () => purgeOfflineCache(),
  };

  const base = createAsyncStoragePersister({
    storage,
    key: CACHE_KEY,
    throttleTime: 2_000,
  });

  const persister: typeof base = {
    persistClient: async (client) => {
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
  };

  const [unsubscribe] = persistQueryClient({
    queryClient,
    persister,
    maxAge: MAX_AGE_MS,
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
  });

  return unsubscribe;
}
