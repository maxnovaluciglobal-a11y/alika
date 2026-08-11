export type DiffKind = "equal" | "added" | "removed";

export interface DiffLine {
  kind: DiffKind;
  text: string;
}

/** Compara dos textos línea a línea usando la subsecuencia común más larga. */
export function diffLineas(anterior: string, actual: string): DiffLine[] {
  const a = anterior.split("\n");
  const b = actual.split("\n");
  const n = a.length;
  const m = b.length;

  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const salida: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      salida.push({ kind: "equal", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      salida.push({ kind: "removed", text: a[i] });
      i++;
    } else {
      salida.push({ kind: "added", text: b[j] });
      j++;
    }
  }
  while (i < n) salida.push({ kind: "removed", text: a[i++] });
  while (j < m) salida.push({ kind: "added", text: b[j++] });

  return salida;
}

/** Resumen numérico de líneas agregadas y eliminadas. */
export function resumenDiff(lineas: DiffLine[]) {
  return {
    agregadas: lineas.filter((l) => l.kind === "added").length,
    eliminadas: lineas.filter((l) => l.kind === "removed").length,
  };
}
