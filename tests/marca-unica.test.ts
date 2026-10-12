import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { conNombreAnterior, leerCookieConAnterior } from "@/lib/compat/nombres-anteriores";

// La marca es Esmalia. El nombre anterior solo puede aparecer (armado por
// partes) en el módulo de compatibilidad, que acepta cookies, enlaces y datos
// locales ya emitidos con ese nombre.
const ANTERIOR = new RegExp(["al", "ika"].join(""), "i");
const PERMITIDOS = new Set(["lib/compat/nombres-anteriores.ts"]);

function archivos(dir: string): string[] {
  // Las carpetas ocultas (.impeccable, etc.) son cachés locales de herramientas,
  // fuera de git.
  return readdirSync(dir).flatMap((nombre) => {
    if (nombre.startsWith(".")) return [];
    const ruta = path.join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

describe("marca única", () => {
  it("ningún archivo de src/ ni public/ nombra la marca anterior", () => {
    const hallazgos: string[] = [];
    for (const raiz of ["../src", "../public"]) {
      const base = path.resolve(__dirname, raiz);
      for (const archivo of archivos(base)) {
        const relativo = path.relative(path.resolve(__dirname, "../src"), archivo);
        if (PERMITIDOS.has(relativo) || /\.(png|jpe?g|webp|ico|woff2?|pdf)$/.test(archivo))
          continue;
        if (ANTERIOR.test(readFileSync(archivo, "utf8"))) hallazgos.push(relativo);
      }
    }
    expect(hallazgos).toEqual([]);
  });

  it("lee la cookie nueva y, si falta, la anterior", () => {
    const anterior = ["al", "ika"].join("") + "_portal_session";
    expect(leerCookieConAnterior("esmalia_portal_session=nuevo", "esmalia_portal_session")).toBe(
      "nuevo",
    );
    expect(leerCookieConAnterior(`a=1; ${anterior}=viejo`, "esmalia_portal_session")).toBe("viejo");
    expect(leerCookieConAnterior("x_esmalia_portal_session=no", "esmalia_portal_session")).toBe(
      null,
    );
  });

  it("acepta el issuer nuevo y el anterior", () => {
    expect(conNombreAnterior("esmalia:portal")).toEqual([
      "esmalia:portal",
      ["al", "ika"].join("") + ":portal",
    ]);
  });
});
