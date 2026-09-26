// src/lib/csv/column-mapping.ts
//
// Recomendación #5 del benchmark de onboarding (25-sep-2026, ver memoria
// alika_onboarding_benchmark_20260925): hasta ahora los importadores CSV
// (pacientes, citas) solo reconocían un diccionario fijo de alias de header
// ("documento", "rut", "documento_paciente", ...). Cubre la mayoría de los
// exports reales, pero cuando el CSV de quien migra trae un nombre de
// columna que no está en la lista, la fila se descartaba en silencio sin
// avisar por qué.
//
// Esto agrega el paso que faltaba: si algún campo OBLIGATORIO no matcheó
// ningún alias, se le muestra al usuario un mapeo manual "tu columna X → mi
// campo Y" antes de seguir. Si todo matcheó solo (el caso común, exports de
// Dentalink/Excel con headers previsibles), el paso ni se muestra — sigue
// siendo cero-fricción para el caso feliz.

/** Mismo criterio de normalización que ya usaban `pacientes.index.tsx` y
 *  `agenda.tsx` por separado (duplicado que este módulo absorbe): NFD +
 *  strip de diacríticos vía rango escapado (nunca literal — CLAUDE.md regla
 *  13, `scripts/check-invisibles.mjs` lo rechaza) + espacios a guión bajo. */
export function normalizarHeaderCsv(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

export interface CsvFieldSpec {
  key: string;
  label: string;
  required: boolean;
  /** Alias ya normalizados (ver `normalizarHeaderCsv`) que auto-matchean este campo. */
  aliases: string[];
}

export interface CsvParsed {
  /** Headers tal como vienen en el archivo (sin normalizar) — lo que ve el usuario. */
  headers: string[];
  /** Filas crudas, indexadas por header original. */
  rows: Record<string, string>[];
}

/** Parsea el archivo sin aplicar ningún alias — a diferencia de los
 *  importadores viejos, que normalizaban y mapeaban en el mismo paso. Separar
 *  "leer el CSV" de "decidir qué columna es cada campo" es lo que permite
 *  mostrar el paso de mapeo manual cuando el auto-detect no alcanza. */
export function parseCsvRaw(file: File): Promise<CsvParsed> {
  return new Promise((resolve, reject) => {
    import("papaparse").then(({ default: Papa }) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          resolve({ headers: res.meta.fields ?? [], rows: res.data });
        },
        error: (err) => reject(err),
      });
    });
  });
}

/** Para cada campo, busca el primer header cuyo valor normalizado esté en
 *  sus alias. Nunca elige "el que más se parece" — o hay un match exacto
 *  contra el diccionario de alias, o el campo queda sin auto-detectar y pasa
 *  al mapeo manual. */
export function autoDetectMapping(
  headers: string[],
  fields: CsvFieldSpec[],
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  for (const field of fields) {
    const header = headers.find((h) => field.aliases.includes(normalizarHeaderCsv(h)));
    mapping[field.key] = header ?? null;
  }
  return mapping;
}

/** `true` si falta mapear al menos un campo obligatorio — es la señal para
 *  mostrar (o no) el paso de mapeo manual. */
export function faltanCamposObligatorios(
  mapping: Record<string, string | null>,
  fields: CsvFieldSpec[],
): boolean {
  return fields.some((f) => f.required && !mapping[f.key]);
}

/** Aplica el mapeo confirmado (auto + manual) sobre las filas crudas,
 *  devolviendo un objeto por fila con las keys de `fields` y el valor de la
 *  columna elegida (trimmed, "" si la columna no tiene valor esa fila). */
export function aplicarMapeo(
  rows: Record<string, string>[],
  mapping: Record<string, string | null>,
  fields: CsvFieldSpec[],
): Record<string, string>[] {
  return rows.map((row) => {
    const fila: Record<string, string> = {};
    for (const field of fields) {
      const header = mapping[field.key];
      fila[field.key] = header ? (row[header]?.trim() ?? "") : "";
    }
    return fila;
  });
}
