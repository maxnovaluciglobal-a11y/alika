/**
 * Acceso diferido al cliente de Supabase, para el código que corre en el
 * navegador.
 *
 * Por qué existe: `routeTree.gen.ts` importa TODOS los módulos de ruta de
 * forma eager, así que un `import { supabase } from "./client"` en el tope de
 * cualquier archivo de ruta arrastra la librería (~200 KB) al chunk de entrada
 * — y termina descargándola también quien sólo abre la landing y nunca inicia
 * sesión.
 *
 * El `import()` dinámico lo memoiza el propio sistema de módulos: llamar esto
 * mil veces carga el cliente una sola vez, y siempre devuelve la misma
 * instancia que `./client`. No usar en código de servidor (ahí va
 * `client.server.ts`).
 */
export function getSupabase() {
  return import("./client").then((m) => m.supabase);
}
