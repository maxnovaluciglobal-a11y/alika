import type { OdontogramMark, ToothCondition } from "@/lib/clinical/odontogram";

export interface PiezaConHallazgos {
  tooth: number;
  /** Condiciones vigentes distintas de "sano", sin repetir, en orden de aparición. */
  condiciones: ToothCondition[];
}

/**
 * Piezas con algo registrado para el resumen de la ficha: solo marcas
 * vigentes (las reemplazadas tienen `supersededAt`) y sin "sano", que no es
 * un hallazgo. Ordenadas por número FDI.
 */
export function piezasConHallazgos(marks: OdontogramMark[]): PiezaConHallazgos[] {
  const porPieza = new Map<number, ToothCondition[]>();
  for (const m of marks) {
    if (m.supersededAt || m.condition === "sano") continue;
    const condiciones = porPieza.get(m.toothNumber) ?? [];
    if (!condiciones.includes(m.condition)) condiciones.push(m.condition);
    porPieza.set(m.toothNumber, condiciones);
  }
  return [...porPieza.entries()]
    .sort(([a], [b]) => a - b)
    .map(([tooth, condiciones]) => ({ tooth, condiciones }));
}
