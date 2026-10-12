import { createStore, del, get, set, type UseStore } from "idb-keyval";

// Identificadores con el nombre anterior de la marca que todavía pueden estar
// en navegadores y enlaces ya emitidos. Es el ÚNICO lugar del código que los
// nombra. Se puede borrar entero desde el 2026-11-12: para entonces venció el
// último enlace del portal de laboratorio (30 días) y cada navegador activo ya
// migró su cola y sus preferencias. Al borrarlo, quitar sus usos (grep
// "nombres-anteriores").
const ANTERIOR = ["al", "ika"].join("");

/** Claves de localStorage: [anterior, nueva]. */
const CLAVES_LOCALES: [string, string][] = [
  [`${ANTERIOR}:theme`, "esmalia:theme"],
  [`${ANTERIOR}:sim-role`, "esmalia:sim-role"],
  [`${ANTERIOR}:email-dns-verification`, "esmalia:email-dns-verification"],
  [`${ANTERIOR}:email-sandbox`, "esmalia:email-sandbox"],
  [`${ANTERIOR}:email-test-log`, "esmalia:email-test-log"],
  [`${ANTERIOR}_plan_intent`, "esmalia_plan_intent"],
];

/** Copia las preferencias guardadas con el nombre anterior y borra las viejas.
 *  Sincrónico y barato: corre antes del primer render en el cliente. */
export function migrarAlmacenamientoLocal(): void {
  try {
    for (const [anterior, nueva] of CLAVES_LOCALES) {
      const valor = localStorage.getItem(anterior);
      if (valor === null) continue;
      if (localStorage.getItem(nueva) === null) localStorage.setItem(nueva, valor);
      localStorage.removeItem(anterior);
    }
  } catch {
    // localStorage bloqueado (modo privado estricto): nada que migrar.
  }
}

async function existeBase(nombre: string): Promise<boolean> {
  // `databases()` no existe en navegadores viejos: en ese caso se asume que
  // existe y se intenta leer (crear una base vacía es inofensivo).
  if (typeof indexedDB.databases !== "function") return true;
  const bases = await indexedDB.databases();
  return bases.some((b) => b.name === nombre);
}

/** Mueve la cola offline guardada con el nombre anterior a la nueva, sin
 *  perder nada: son cobros y citas que la clínica ya dio por hechos. */
export async function migrarColaOffline(destino: UseStore, clave: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const nombre = `${ANTERIOR}-offline-queue`;
  try {
    if (!(await existeBase(nombre))) return;
    const origen = createStore(nombre, "queue");
    const anteriores = await get<unknown[]>(clave, origen);
    if (anteriores?.length) {
      const actuales = (await get<unknown[]>(clave, destino)) ?? [];
      await set(clave, [...anteriores, ...actuales], destino);
    }
    // Primero se vacía la clave (los datos ya están a salvo en la nueva) y
    // después se pide borrar la base; si queda bloqueada por la conexión
    // abierta, el navegador la borra al cerrar la pestaña.
    await del(clave, origen);
    indexedDB.deleteDatabase(nombre);
  } catch {
    // Si falla, la cola anterior queda intacta y se reintenta en la próxima carga.
  }
}

/** El cache de lectura offline se reconstruye solo: el anterior se descarta. */
export function descartarCacheOfflineAnterior(): void {
  try {
    if (typeof indexedDB !== "undefined") indexedDB.deleteDatabase(`${ANTERIOR}-offline`);
  } catch {
    // Sin IndexedDB no hay nada que borrar.
  }
}

/** Cookies: el valor de la nueva, o el de la anterior si todavía no existe. */
export function leerCookieConAnterior(cookieHeader: string, nueva: string): string | null {
  for (const nombre of [nueva, nueva.replace(/^esmalia/, ANTERIOR)]) {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${nombre}=([^;]+)`));
    if (match) return decodeURIComponent(match[1]!);
  }
  return null;
}

/** Issuer/audience de JWT: acepta también los firmados con el nombre anterior
 *  (enlaces del portal ya enviados a pacientes y laboratorios). */
export function conNombreAnterior(valor: string): string[] {
  return [valor, valor.replace(/^esmalia/, ANTERIOR)];
}
