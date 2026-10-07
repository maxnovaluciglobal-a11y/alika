import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  clasePastilla,
  tonoDeCita,
  tonoDeEstadoCita,
} from "@/lib/clinic-operations/estado-cita-tono";

// Guardia del sistema de color (auditoría 07-oct-2026): los colores salen de
// los tokens de styles.css. Una clase de la paleta de Tailwind (amber-600,
// emerald-600, sky-50…) se salta el sistema, no tiene modo oscuro pensado y
// en dos casos no llegaba a AA.
const PALETA_TAILWIND =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|decoration)-(?:red|green|amber|emerald|blue|yellow|sky|rose|orange|violet|purple|pink|teal|cyan|lime|indigo|fuchsia|slate|gray|zinc|stone)-\d{2,3}\b/;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = path.join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(tsx?|css)$/.test(nombre) ? [ruta] : [];
  });
}

describe("sistema de color", () => {
  it("no usa clases de la paleta de Tailwind fuera de los tokens", () => {
    const raiz = path.resolve(__dirname, "../src");
    const hallazgos = archivos(raiz).flatMap((ruta) =>
      readFileSync(ruta, "utf8")
        .split("\n")
        .flatMap((linea, i) => {
          const m = linea.match(PALETA_TAILWIND);
          return m ? [`${path.relative(raiz, ruta)}:${i + 1} ${m[0]}`] : [];
        }),
    );
    expect(hallazgos).toEqual([]);
  });

  it("cada estado de cita tiene un tono distinto", () => {
    const tonos = Object.values(tonoDeEstadoCita);
    expect(new Set(tonos).size).toBe(tonos.length);
    for (const tono of tonos) expect(clasePastilla[tono]).toBeTruthy();
  });

  it("una tentativa que el paciente confirmó se ve como confirmada", () => {
    expect(tonoDeCita({ estado: "tentativa", pacienteConfirmo: true })).toBe("success");
    expect(tonoDeCita({ estado: "tentativa", pacienteConfirmo: false })).toBe("warning");
    expect(tonoDeCita({ estado: "ausente" })).toBe("danger");
  });
});
