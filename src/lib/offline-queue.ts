import { createStore, del, get, set } from "idb-keyval";

/**
 * Cola de operaciones capturadas sin conexión.
 *
 * Vive aparte del cache de lectura (`offline-cache.ts`) a propósito: ese se
 * puede tirar entero sin perder nada, este NO — son cobros y citas que el
 * equipo ya dio por hechos frente al paciente. Por eso tiene su propia base,
 * no caduca sola y nunca se borra "por las dudas".
 */
const DB_NAME = "alika-offline-queue";
const STORE_NAME = "queue";
const QUEUE_KEY = "items";

/** Qué operaciones sabe reproducir la cola. */
export type OperacionKind = "crear-cita" | "registrar-pago" | "cambiar-estado-cita";

export type EstadoItem =
  /** Esperando conexión. */
  | "pendiente"
  /** Falló por algo que reintentar no va a arreglar (validación, permisos). */
  | "fallido";

export type ItemCola = {
  /** Identidad de la fila en la cola, no del registro que va a crear. */
  localId: string;
  /**
   * Quién lo capturó. En una PC compartida, el turno siguiente no ve ni
   * sincroniza lo que dejó el turno anterior: cada uno despacha lo suyo
   * cuando vuelve a entrar.
   */
  userId: string;
  kind: OperacionKind;
  /**
   * El payload EXACTO que recibiría la server function online, sin
   * transformar. GastroCore aprendió esto a los golpes: su cola de Caja
   * pre-convertía el monto a centavos y el servidor lo volvía a convertir,
   * multiplicando todo por 100. La regla es que la ruta offline y la online
   * manden lo mismo, byte por byte.
   */
  payload: Record<string, unknown>;
  /** Cuándo lo capturó el equipo (no cuándo sincroniza). */
  capturedAt: string;
  /** Para mostrarlo en la lista de pendientes sin tener que interpretar el payload. */
  resumen: string;
  intentos: number;
  estado: EstadoItem;
  /** Motivo del último fallo definitivo, para poder mostrarlo. */
  error?: string;
};

function store() {
  return createStore(DB_NAME, STORE_NAME);
}

export async function leerCola(): Promise<ItemCola[]> {
  try {
    return (await get<ItemCola[]>(QUEUE_KEY, store())) ?? [];
  } catch {
    return [];
  }
}

async function escribirCola(items: ItemCola[]) {
  if (items.length === 0) {
    await del(QUEUE_KEY, store());
    return;
  }
  await set(QUEUE_KEY, items, store());
}

/** Los que avisan al usuario que sigue habiendo trabajo sin sincronizar. */
export function pendientes(items: ItemCola[]) {
  return items.filter((i) => i.estado === "pendiente");
}

export function fallidos(items: ItemCola[]) {
  return items.filter((i) => i.estado === "fallido");
}

const suscriptores = new Set<(items: ItemCola[]) => void>();

export function suscribirCola(fn: (items: ItemCola[]) => void) {
  suscriptores.add(fn);
  void leerCola().then(fn);
  return () => suscriptores.delete(fn);
}

async function notificar() {
  const items = await leerCola();
  for (const fn of suscriptores) fn(items);
}

export async function encolar(item: Omit<ItemCola, "intentos" | "estado">) {
  const items = await leerCola();
  items.push({ ...item, intentos: 0, estado: "pendiente" });
  await escribirCola(items);
  await notificar();
}

export async function quitarDeCola(localId: string) {
  await escribirCola((await leerCola()).filter((i) => i.localId !== localId));
  await notificar();
}

export async function marcarFallido(localId: string, error: string) {
  const items = await leerCola();
  const item = items.find((i) => i.localId === localId);
  if (item) {
    item.estado = "fallido";
    item.error = error;
    item.intentos += 1;
    await escribirCola(items);
    await notificar();
  }
}

export async function contarIntento(localId: string) {
  const items = await leerCola();
  const item = items.find((i) => i.localId === localId);
  if (item) {
    item.intentos += 1;
    await escribirCola(items);
  }
}

/** Descarta un fallo definitivo que el usuario ya revisó. */
export async function descartarFallido(localId: string) {
  await quitarDeCola(localId);
}

/**
 * A diferencia del cache de lectura, la cola NO se borra al cerrar sesión:
 * lo que hay adentro son cobros y citas que el equipo ya dio por hechos
 * frente al paciente. Tirarlos sería perder plata registrada. Sobreviven
 * hasta que quien los capturó vuelva a entrar y sincronicen.
 *
 * Esta función existe solo para el descarte deliberado desde la UI de
 * pendientes, nunca como limpieza automática.
 */
export async function descartarTodoDe(userId: string) {
  await escribirCola((await leerCola()).filter((i) => i.userId !== userId));
  await notificar();
}
