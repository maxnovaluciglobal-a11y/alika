import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  clasePastilla,
  estiloDeCita,
  estiloEstadoCita,
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

  it("cada estado tiene una combinación distinta de forma e ícono", () => {
    const estilos = Object.values(estiloEstadoCita);
    const combos = estilos.map((e) => `${e.forma}/${e.icono}`);
    expect(new Set(combos).size).toBe(combos.length);
    // Los íconos solos ya distinguen los cinco estados (sirve en gris).
    expect(new Set(estilos.map((e) => e.icono)).size).toBe(estilos.length);
  });

  it("en sala es el único estado sólido", () => {
    const solidos = Object.entries(estiloEstadoCita).filter(([, e]) => e.forma === "solido");
    expect(solidos.map(([estado]) => estado)).toEqual(["en-sala"]);
    expect(estiloEstadoCita["en-sala"].clase).toContain("bg-info");
    expect(estiloEstadoCita["en-sala"].clase).toContain("text-background");
  });

  it("confirmada y ausente no dependen solo del color (deuteranopía)", () => {
    const c = estiloEstadoCita.confirmada;
    const a = estiloEstadoCita.ausente;
    expect(c.icono).not.toBe(a.icono);
    expect(c.tono).toBe("success");
    expect(a.tono).toBe("danger");
  });

  it("sin respuesta va punteado con reloj y finalizada es solo texto", () => {
    expect(estiloEstadoCita.tentativa).toMatchObject({ forma: "punteado", icono: "reloj" });
    expect(estiloEstadoCita.tentativa.clase).toContain("border-dashed");
    expect(estiloEstadoCita.finalizada.forma).toBe("texto");
    expect(estiloEstadoCita.finalizada.clase).toContain("bg-transparent");
    expect(estiloEstadoCita.finalizada.clase).toContain("text-neutral");
  });

  it("el tono de cada forma sale del mapa único de tonos", () => {
    for (const [estado, e] of Object.entries(estiloEstadoCita)) {
      expect(e.tono).toBe(tonoDeEstadoCita[estado as keyof typeof tonoDeEstadoCita]);
    }
  });

  it("una tentativa que el paciente confirmó toma la forma de confirmada", () => {
    expect(estiloDeCita({ estado: "tentativa", pacienteConfirmo: true })).toBe(
      estiloEstadoCita.confirmada,
    );
    expect(estiloDeCita({ estado: "tentativa" })).toBe(estiloEstadoCita.tentativa);
  });
});
