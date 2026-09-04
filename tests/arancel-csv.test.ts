import { describe, expect, it } from "vitest";
import { parseArancelCsv, parsearMonto } from "../src/lib/arancel-csv";

/**
 * El importador de arancel (G-4) es la puerta de entrada de toda migración:
 * si parsea mal la planilla de un cliente, el onboarding se muere ahí. Estos
 * casos son los que produce Excel en español de verdad, no CSV de manual.
 */

describe("parsearMonto", () => {
  it("quita el símbolo de moneda y los separadores de miles", () => {
    expect(parsearMonto("$45.000")).toBe(45000);
    expect(parsearMonto("45.000")).toBe(45000);
    expect(parsearMonto("1.250.000")).toBe(1250000);
  });

  it("interpreta la coma final como decimal (formato es-CL) y NO redondea", () => {
    // Devuelve la unidad visible, no cents: quien convierte es `toCents`, con
    // la moneda de la clínica. Antes redondeaba acá y eso solo era correcto en
    // CLP — en MXN "45.000,50" tiene que llegar a 4500050 cents, no a 45001.
    expect(parsearMonto("45.000,50")).toBe(45000.5);
    expect(parsearMonto("100,4")).toBe(100.4);
  });

  it("interpreta la coma como separador de miles cuando no hay decimales", () => {
    expect(parsearMonto("45,000")).toBe(45000);
  });

  it("vacío es null y no cero — sin dato no es sin costo (regla 11)", () => {
    expect(parsearMonto("")).toBeNull();
    expect(parsearMonto("   ")).toBeNull();
    expect(parsearMonto(undefined)).toBeNull();
  });

  it("texto sin dígitos es null, no NaN", () => {
    expect(parsearMonto("consultar")).toBeNull();
    expect(parsearMonto("-")).toBeNull();
  });

  it("un cero explícito sí es cero", () => {
    expect(parsearMonto("0")).toBe(0);
    expect(parsearMonto("$0")).toBe(0);
  });
});

describe("parseArancelCsv", () => {
  it("lee un CSV separado por coma", () => {
    const { filas, errores } = parseArancelCsv("Nombre,Precio\nConsulta,25000\nDestartraje,45000");
    expect(errores).toEqual([]);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ name: "Consulta", price: 25000 });
    expect(filas[1]).toMatchObject({ name: "Destartraje", price: 45000 });
  });

  it("lee un CSV separado por punto y coma, que es lo que exporta Excel en español", () => {
    const { filas } = parseArancelCsv("Nombre;Precio\nConsulta;$25.000");
    expect(filas[0]).toMatchObject({ name: "Consulta", price: 25000 });
  });

  it("respeta las comas dentro de campos entrecomillados", () => {
    const { filas } = parseArancelCsv('Nombre,Precio\n"Corona metálica, preformada",90000');
    expect(filas[0].name).toBe("Corona metálica, preformada");
    expect(filas[0].price).toBe(90000);
  });

  it('trata "" dentro de comillas como una comilla literal, que es como escapa Excel', () => {
    const { filas } = parseArancelCsv('Nombre,Precio\n"Pieza ""24"" endodoncia",120000');
    expect(filas[0].name).toBe('Pieza "24" endodoncia');
  });

  it("reconoce los encabezados sin importar acentos ni mayúsculas", () => {
    const { filas } = parseArancelCsv(
      "PRESTACIÓN;Categoría;Precio Final\nSellante;Odontopediatría;25000",
    );
    expect(filas[0]).toMatchObject({
      name: "Sellante",
      category: "Odontopediatría",
      price: 25000,
    });
  });

  it("acepta alias de encabezado en inglés y en español", () => {
    const { filas } = parseArancelCsv("name,price\nConsulta,25000");
    expect(filas[0]).toMatchObject({ name: "Consulta", price: 25000 });
  });

  it("mapea valor referencial, costo de laboratorio y duración cuando vienen", () => {
    const { filas } = parseArancelCsv(
      "Nombre;Precio;Valor referencial;Costo laboratorio;Duración\nCorona;350000;300000;80000;60",
    );
    expect(filas[0]).toMatchObject({
      price: 350000,
      referencePrice: 300000,
      labCost: 80000,
      durationMin: 60,
    });
  });

  it("las columnas ausentes quedan en null, no en cero", () => {
    const { filas } = parseArancelCsv("Nombre,Precio\nConsulta,25000");
    expect(filas[0].referencePrice).toBeNull();
    expect(filas[0].labCost).toBeNull();
    expect(filas[0].durationMin).toBeNull();
  });

  it("permite descuento por defecto, y lo respeta cuando la columna dice que no", () => {
    const { filas } = parseArancelCsv(
      "Nombre;Precio;Permite descuento\nConsulta;25000;Sí\nBonificada;0;No",
    );
    expect(filas[0].allowsDiscount).toBe(true);
    expect(filas[1].allowsDiscount).toBe(false);
  });

  it("omite las filas sin nombre y las reporta como error, sin abortar el resto", () => {
    const { filas, errores } = parseArancelCsv("Nombre,Precio\n,25000\nConsulta,30000");
    expect(filas).toHaveLength(1);
    expect(filas[0].name).toBe("Consulta");
    expect(errores).toHaveLength(1);
    expect(errores[0]).toContain("Fila 2");
  });

  it("sin columna de nombre no importa nada y dice por qué", () => {
    const { filas, errores } = parseArancelCsv("Codigo,Precio\nA1,25000");
    expect(filas).toEqual([]);
    expect(errores[0]).toContain("Nombre");
  });

  it("archivo vacío no explota", () => {
    expect(parseArancelCsv("").filas).toEqual([]);
    expect(parseArancelCsv("\n\n  \n").filas).toEqual([]);
  });

  it("una prestación sin precio entra en 0 — visible y corregible, no descartada", () => {
    const { filas } = parseArancelCsv("Nombre,Precio\nA convenir,");
    expect(filas[0]).toMatchObject({ name: "A convenir", price: 0 });
  });

  it("soporta saltos de línea CRLF de Windows", () => {
    const { filas } = parseArancelCsv("Nombre,Precio\r\nConsulta,25000\r\n");
    expect(filas).toHaveLength(1);
    expect(filas[0].name).toBe("Consulta");
  });
});
