import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guardia del tuteo neutro (09-oct-2026): Esmalia le habla a clínicas de
// Chile, México, Colombia, Perú y Argentina, así que la interfaz usa "tú"
// sin voseo. El PR #26 pasó la interfaz a tuteo, pero 35 mensajes de error
// del servidor ("Revisá los datos y volvé a intentar") siguieron en voseo
// porque nadie los veía hasta que fallaba algo.
//
// También las formas con pronombre pegado (avisale, escribiles), que no
// llevan tilde y se escaparon de la primera versión del test.
// El 10-oct se colaron "Detectala" y "creés" en /recursos/fugas-clinica-dental:
// la carpeta sí se escaneaba, pero esas formas no estaban en la lista. Se
// sumaron junto con otras del mismo tipo (subjuntivo/presente con tilde y
// enclíticos de imperativo).
// Lista de formas verbales de voseo, no un detector genérico: con tilde final
// en la segunda persona (revisá, tenés, podés) son inequívocas en español.
// `\b` no sirve: en JS trata la "á" como no-letra, así que "esperá" calzaba
// dentro de "esperábamos". Los límites se marcan con letras Unicode.
const VOSEO =
  /(?<!\p{L})(?:probá|revisá|intentá|reintentá|volvé|elegí|describí|escribí|completá|ingresá|mirá|hacé|tenés|podés|querés|necesitás|sabés|confirmás|agregá|guardá|cargá|seleccioná|confirmá|esperá|usá|abrí|cerrá|buscá|creá|activá|editá|borrá|subí|descargá|tocá|pegá|copiá|contactá|avisá|llamá|avisale|avisales|escribile|escribiles|contale|contales|decile|mandale|mandales|pedile|llamale|miralo|miralos|detectala|detectalo|creés|evitá|fijate|acordate|pensás|decís|perdés|pagás|cobrás|empezá|calculá|compará|conocé|enterate)(?!\p{L})/iu;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = path.join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.tsx?$/.test(nombre) ? [ruta] : [];
  });
}

/** Una línea de comentario (// … o * … dentro de un bloque /** *\/). */
function esComentario(linea: string): boolean {
  const t = linea.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*");
}

describe("tuteo neutro", () => {
  it("ningún texto del código usa voseo", () => {
    const raiz = path.resolve(__dirname, "../src");
    const hallazgos: string[] = [];
    for (const archivo of archivos(raiz)) {
      readFileSync(archivo, "utf8")
        .split("\n")
        .forEach((linea, i) => {
          if (!esComentario(linea) && VOSEO.test(linea)) {
            hallazgos.push(`${path.relative(raiz, archivo)}:${i + 1}: ${linea.trim()}`);
          }
        });
    }
    expect(hallazgos).toEqual([]);
  });
});
