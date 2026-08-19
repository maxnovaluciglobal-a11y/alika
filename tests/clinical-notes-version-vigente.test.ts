import { describe, expect, it } from "vitest";
import { versionVigente } from "../src/lib/clinical-notes";

/**
 * Prueba pura, sin DB: cubre el bug real que arregla `versionVigente` — el
 * badge de "versión vigente" tomaba el número más alto del historial, que
 * deja de coincidir con el contenido real de la nota apenas hay un conflicto
 * offline sin resolver (ver el comentario de la función para el porqué).
 */
describe("versionVigente", () => {
  it("sin conflictos, la vigente es simplemente la más alta", () => {
    const nota = { title: "Control", content: "v3" };
    const versiones = [
      { version: 1, title: "Control", content: "v1" },
      { version: 2, title: "Control", content: "v2" },
      { version: 3, title: "Control", content: "v3" },
    ];
    expect(versionVigente(nota, versiones)).toBe(3);
  });

  it("con un conflicto sin resolver, ignora la versión huérfana de número más alto", () => {
    // v2 es lo que realmente está guardado en clinical_notes.content — v3 se
    // insertó en el guardado offline en conflicto pero nunca se aplicó.
    const nota = { title: "Control", content: "v2" };
    const versiones = [
      { version: 1, title: "Control", content: "v1" },
      { version: 2, title: "Control", content: "v2" },
      { version: 3, title: "Control", content: "contenido en conflicto, sin aplicar" },
    ];
    expect(versionVigente(nota, versiones)).toBe(2);
  });

  it("si el conflicto se descarta para siempre, la huérfana nunca vuelve a contar", () => {
    // Mismo escenario que arriba pero permanente: "descartar" no borra la
    // fila ni la actualiza, solo la saca de la cola local.
    const nota = { title: "Control", content: "v2" };
    const versiones = [
      { version: 1, title: "Control", content: "v1" },
      { version: 2, title: "Control", content: "v2" },
      { version: 3, title: "Control", content: "descartada, huérfana para siempre" },
    ];
    expect(versionVigente(nota, versiones)).toBe(2);
  });

  it("al resolver el conflicto con 'usar-mio', la nueva versión sí queda vigente", () => {
    // restoreNoteVersion actualiza clinical_notes Y agrega una v4 con el
    // mismo contenido — acá sí coincide con el número más alto.
    const nota = { title: "Control", content: "contenido restaurado" };
    const versiones = [
      { version: 1, title: "Control", content: "v1" },
      { version: 2, title: "Control", content: "v2" },
      { version: 3, title: "Control", content: "contenido restaurado" },
      { version: 4, title: "Control", content: "contenido restaurado" },
    ];
    expect(versionVigente(nota, versiones)).toBe(4);
  });

  it("sin ninguna versión, no rompe — cae a 1", () => {
    expect(versionVigente({ title: "Nueva", content: "" }, [])).toBe(1);
  });

  it("caso defensivo: si por datos inconsistentes ninguna calza, cae al número más alto", () => {
    const nota = { title: "Control", content: "contenido que no matchea nada" };
    const versiones = [
      { version: 1, title: "Control", content: "v1" },
      { version: 2, title: "Control", content: "v2" },
    ];
    expect(versionVigente(nota, versiones)).toBe(2);
  });
});
