import { describe, expect, it } from "vitest";
import { construirCsv, nombreArchivoCsv, type ColumnaCsv } from "../src/lib/csv-export";

/**
 * Export a CSV de los listados (Tanda C). Lo que se prueba acá no es el
 * formato feliz sino los dos casos que rompen archivos reales: el escapado y
 * la inyección de fórmulas.
 */

interface Fila {
  nombre: string;
  monto: number | null;
  nota?: string | null;
}

const COLUMNAS: ColumnaCsv<Fila>[] = [
  { header: "Nombre", value: (f) => f.nombre },
  { header: "Monto", value: (f) => f.monto },
  { header: "Nota", value: (f) => f.nota },
];

describe("construirCsv", () => {
  it("arma encabezado y filas con separador de Excel en español", () => {
    const csv = construirCsv([{ nombre: "Consulta", monto: 25000, nota: "ok" }], COLUMNAS);
    expect(csv).toBe("Nombre;Monto;Nota\r\nConsulta;25000;ok");
  });

  it("usa CRLF entre filas, que es lo que espera Excel", () => {
    const csv = construirCsv(
      [
        { nombre: "A", monto: 1 },
        { nombre: "B", monto: 2 },
      ],
      COLUMNAS,
    );
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("entrecomilla cuando la celda trae el separador", () => {
    const csv = construirCsv([{ nombre: "Corona; preformada", monto: 90000 }], COLUMNAS);
    expect(csv).toContain('"Corona; preformada"');
  });

  it("duplica las comillas internas (RFC 4180)", () => {
    const csv = construirCsv([{ nombre: 'Pieza "24"', monto: 1 }], COLUMNAS);
    expect(csv).toContain('"Pieza ""24"""');
  });

  it("entrecomilla los saltos de línea en vez de romper la fila", () => {
    const csv = construirCsv([{ nombre: "A", monto: 1, nota: "línea 1\nlínea 2" }], COLUMNAS);
    // Tres saltos serían: cabecera, y la nota partida en dos. Con comillas,
    // la fila sigue siendo una sola.
    expect(csv).toContain('"línea 1\nlínea 2"');
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("null y undefined producen celda vacía, no '0' ni 'null'", () => {
    // En una planilla, "sin dato" es una celda vacía: cualquier otra cosa
    // rompe las sumas y los filtros de quien recibe el archivo.
    const csv = construirCsv([{ nombre: "Sin monto", monto: null, nota: undefined }], COLUMNAS);
    expect(csv).toBe("Nombre;Monto;Nota\r\nSin monto;;");
  });

  it("un cero se exporta como cero, no como vacío", () => {
    const csv = construirCsv([{ nombre: "Bonificada", monto: 0 }], COLUMNAS);
    expect(csv).toContain("Bonificada;0;");
  });

  it("neutraliza celdas que Excel interpretaría como fórmula", () => {
    // CSV injection: un paciente cargado como "=cmd|..." ejecuta al abrir el
    // archivo. El apóstrofo lo vuelve texto sin que se vea en la planilla.
    for (const peligroso of ["=1+1", "+ATTACK()", "-2+3", "@SUM(A1)"]) {
      const csv = construirCsv([{ nombre: peligroso, monto: 1 }], COLUMNAS);
      expect(csv).toContain(`'${peligroso}`);
    }
  });

  it("no toca un nombre que apenas contiene un guion en el medio", () => {
    const csv = construirCsv([{ nombre: "Pérez-González", monto: 1 }], COLUMNAS);
    expect(csv).toContain("Pérez-González");
    expect(csv).not.toContain("'Pérez");
  });

  it("una lista vacía devuelve solo el encabezado", () => {
    expect(construirCsv([], COLUMNAS)).toBe("Nombre;Monto;Nota");
  });

  it("acepta coma como separador para quien la necesite", () => {
    const csv = construirCsv([{ nombre: "A", monto: 1 }], COLUMNAS, ",");
    expect(csv).toBe("Nombre,Monto,Nota\r\nA,1,");
  });
});

describe("nombreArchivoCsv", () => {
  it("saca acentos y espacios", () => {
    expect(nombreArchivoCsv("Arancel de precios", "2026-09-04")).toBe(
      "arancel-de-precios-2026-09-04.csv",
    );
  });

  it("colapsa los separadores repetidos y no deja guiones sueltos en los bordes", () => {
    expect(nombreArchivoCsv("  Gastos / del mes  ", "2026-09-04")).toBe(
      "gastos-del-mes-2026-09-04.csv",
    );
  });
});
