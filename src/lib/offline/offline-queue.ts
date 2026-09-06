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
export type OperacionKind =
  | "crear-cita"
  | "registrar-pago"
  | "cambiar-estado-cita"
  | "guardar-nota"
  | "marcar-odontograma"
  | "actualizar-anamnesis";

export type EstadoItem =
  /** Esperando conexión. */
  | "pendiente"
  /** Falló por algo que reintentar no va a arreglar (validación, permisos). */
  | "fallido"
  /**
   * El servidor guardó la captura pero no la aplicó: otra edición la pisaba.
   * A diferencia de "fallido", acá no hubo error — hace falta que una persona
   * elija entre las dos versiones.
   */
  | "conflicto";

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
  /** Lo que devolvió el servidor cuando estado es "conflicto" (versionId, marca vigente, etc). */
  detalleConflicto?: Record<string, unknown>;
  /**
   * Identifica LO MISMO que esta captura edita (ej. el noteId, o
   * `pacienteId:pieza:superficie`). Una edición offline repetida de lo mismo
   * REEMPLAZA la pendiente anterior en vez de acumularse: si no, la segunda
   * llegaría a sincronizar comparando contra la primera (todavía sin
   * confirmar) en lugar de contra lo que el servidor tenía antes de que el
   * equipo se quedara sin conexión, y se marcaría conflicto contra su propio
   * trabajo. Solo aplica a kinds que editan una entidad puntual — crear-cita
   * y registrar-pago no lo usan, cada captura es un hecho distinto.
   */
  identidad?: string;
};

function store() {
  return createStore(DB_NAME, STORE_NAME);
}

async function leerColaInterna(): Promise<ItemCola[]> {
  try {
    return (await get<ItemCola[]>(QUEUE_KEY, store())) ?? [];
  } catch {
    return [];
  }
}

export async function leerCola(): Promise<ItemCola[]> {
  return leerColaInterna();
}

async function escribirCola(items: ItemCola[]) {
  if (items.length === 0) {
    await del(QUEUE_KEY, store());
    return;
  }
  await set(QUEUE_KEY, items, store());
}

/**
 * Mutex en memoria para las operaciones "leer cola completa → mutarla →
 * escribirla entera". `idb-keyval` no da ninguna primitiva atómica tipo
 * compare-and-swap, así que sin esto dos llamadas casi simultáneas (ej. un
 * autosave de nota clínica y un registro de pago) pueden pisarse: las dos
 * leen el mismo estado viejo, la segunda en escribir gana y el ítem que
 * agregó la primera se pierde en silencio.
 *
 * Encadenar una promesa detrás de la anterior alcanza acá — todo el
 * read-modify-write de esta cola vive en este único módulo y corre en un
 * solo hilo de JS, no hace falta un lock cross-tab. Un `.catch` a la cola
 * evita que un rechazo en una operación deje el mutex trabado para las
 * siguientes.
 */
let colaLock: Promise<unknown> = Promise.resolve();

function conLockDeCola<T>(fn: () => Promise<T>): Promise<T> {
  const resultado = colaLock.then(fn, fn);
  colaLock = resultado.then(
    () => undefined,
    () => undefined,
  );
  return resultado;
}

/** Los que avisan al usuario que sigue habiendo trabajo sin sincronizar. */
export function pendientes(items: ItemCola[]) {
  return items.filter((i) => i.estado === "pendiente");
}

export function fallidos(items: ItemCola[]) {
  return items.filter((i) => i.estado === "fallido");
}

export function conflictos(items: ItemCola[]) {
  return items.filter((i) => i.estado === "conflicto");
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

/**
 * Si `item.identidad` coincide con una pendiente propia del mismo tipo, la
 * reemplaza en vez de acumular — ver el comentario de `identidad` en el tipo
 * `ItemCola`.
 */
export async function encolar(item: Omit<ItemCola, "intentos" | "estado">) {
  await conLockDeCola(async () => {
    const items = await leerColaInterna();
    const idx = item.identidad
      ? items.findIndex(
          (i) =>
            i.userId === item.userId &&
            i.kind === item.kind &&
            i.estado === "pendiente" &&
            i.identidad === item.identidad,
        )
      : -1;
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...item, intentos: 0, estado: "pendiente" };
    } else {
      items.push({ ...item, intentos: 0, estado: "pendiente" });
    }
    await escribirCola(items);
  });
  await notificar();
}

/** Registra directamente en conflicto — camino online-inmediato (dos pestañas, otro dispositivo). */
export async function registrarConflicto(
  item: Omit<ItemCola, "intentos" | "estado"> & { detalleConflicto: Record<string, unknown> },
) {
  await conLockDeCola(async () => {
    const items = await leerColaInterna();
    items.push({ ...item, intentos: 0, estado: "conflicto" });
    await escribirCola(items);
  });
  await notificar();
}

export async function quitarDeCola(localId: string) {
  await conLockDeCola(async () => {
    const items = await leerColaInterna();
    await escribirCola(items.filter((i) => i.localId !== localId));
  });
  await notificar();
}

export async function marcarFallido(localId: string, error: string) {
  await conLockDeCola(async () => {
    const items = await leerColaInterna();
    const item = items.find((i) => i.localId === localId);
    if (item) {
      item.estado = "fallido";
      item.error = error;
      item.intentos += 1;
      await escribirCola(items);
    }
  });
  await notificar();
}

/** Sincronizó, pero el servidor no aplicó la captura porque alguien más cambió lo mismo mientras tanto. */
export async function marcarConflicto(localId: string, detalle: Record<string, unknown>) {
  await conLockDeCola(async () => {
    const items = await leerColaInterna();
    const item = items.find((i) => i.localId === localId);
    if (item) {
      item.estado = "conflicto";
      item.detalleConflicto = detalle;
      item.intentos += 1;
      await escribirCola(items);
    }
  });
  await notificar();
}

export async function contarIntento(localId: string) {
  await conLockDeCola(async () => {
    const items = await leerColaInterna();
    const item = items.find((i) => i.localId === localId);
    if (item) {
      item.intentos += 1;
      await escribirCola(items);
    }
  });
}

/** Descarta un fallo definitivo que el usuario ya revisó. */
export async function descartarFallido(localId: string) {
  await quitarDeCola(localId);
}

/** Descarta la captura offline en conflicto: se queda con lo que ya está vigente en el servidor. */
export async function descartarConflicto(localId: string) {
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
  await conLockDeCola(async () => {
    const items = await leerColaInterna();
    await escribirCola(items.filter((i) => i.userId !== userId));
  });
  await notificar();
}
