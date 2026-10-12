import type { Coleccion, PaginaContenido } from "./tipos";

// Registro de páginas editoriales. Cada archivo de src/content/paginas/
// exporta `pagina`; agregar una página = crear el archivo. Rutas, sitemap,
// índices y /llms.txt la toman solas. Los borradores quedan fuera de todo.
//
// Carga diferida a propósito: routeTree.gen.ts importa todas las rutas de
// forma eager, así que un glob eager metía el texto de TODAS las páginas en
// el chunk de entrada de la landing. Así, cada página es su propio chunk.
const cargadores = import.meta.glob<{ pagina: PaginaContenido }>("./paginas/*.ts");

/** Path público → archivo. Convención: "/funciones/x" ↔ "funciones-x.ts",
 *  "/software-dental-chile" ↔ "pais-chile.ts". */
export function archivoDe(path: string): string {
  const pais = /^\/software-dental-([a-z-]+)$/.exec(path);
  if (pais) return `./paginas/pais-${pais[1]}.ts`;
  return `./paginas/${path.replace(/^\//, "").replace("/", "-")}.ts`;
}

export async function todasLasPaginas(): Promise<PaginaContenido[]> {
  const modulos = await Promise.all(Object.values(cargadores).map((cargar) => cargar()));
  return modulos.map((m) => m.pagina).sort((a, b) => a.path.localeCompare(b.path));
}

export async function paginasPublicadas(...colecciones: Coleccion[]): Promise<PaginaContenido[]> {
  return (await todasLasPaginas()).filter(
    (p) => !p.borrador && (colecciones.length === 0 || colecciones.includes(p.coleccion)),
  );
}

export async function paginaPorPath(path: string): Promise<PaginaContenido | undefined> {
  const cargar = cargadores[archivoDe(path)];
  if (!cargar) return undefined;
  const { pagina } = await cargar();
  return pagina.borrador || pagina.path !== path ? undefined : pagina;
}

export const NOMBRE_COLECCION: Record<Coleccion, string> = {
  funciones: "Funciones",
  pais: "Por país",
  comparar: "Comparativas",
  alternativas: "Alternativas",
  guias: "Guías",
  plantillas: "Plantillas",
  para: "Según tu clínica",
};

/** Lo mínimo para enlazar una página desde otra o desde un índice. */
export interface Enlace {
  path: string;
  h1: string;
  enUnaLinea: string;
  coleccion: Coleccion;
}

export function aEnlace(p: PaginaContenido): Enlace {
  return { path: p.path, h1: p.h1, enUnaLinea: p.enUnaLinea, coleccion: p.coleccion };
}
