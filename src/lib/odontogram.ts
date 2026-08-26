/** Superficies dentales estándar (patrón FDI simplificado). */
export const TOOTH_SURFACES = [
  "mesial",
  "distal",
  "oclusal",
  "vestibular",
  "lingual",
  "whole",
] as const;
export type ToothSurface = (typeof TOOTH_SURFACES)[number];

export const SURFACE_LABELS: Record<ToothSurface, string> = {
  mesial: "Mesial",
  distal: "Distal",
  oclusal: "Oclusal / Incisal",
  vestibular: "Vestibular",
  lingual: "Lingual / Palatino",
  whole: "Pieza completa",
};

export const TOOTH_CONDITIONS = [
  "sano",
  "caries",
  "obturacion",
  "endodoncia",
  "corona",
  "implante",
  "ausente",
  "sellante",
  "fractura",
  "protesis",
] as const;
export type ToothCondition = (typeof TOOTH_CONDITIONS)[number];

export const CONDITION_LABELS: Record<ToothCondition, string> = {
  sano: "Sano",
  caries: "Caries",
  obturacion: "Obturación",
  endodoncia: "Endodoncia",
  corona: "Corona",
  implante: "Implante",
  ausente: "Ausente",
  sellante: "Sellante",
  fractura: "Fractura",
  protesis: "Prótesis",
};

/**
 * Color por condición para el SVG. Los tokens del design system no cubren
 * todos los estados clínicos, así que se declaran acá con hex explícitos
 * pensados para leerse bien tanto en claro como en oscuro.
 */
export const CONDITION_COLORS: Record<ToothCondition, string> = {
  sano: "#e2e8f0",
  caries: "#dc2626",
  obturacion: "#2563eb",
  endodoncia: "#7c3aed",
  corona: "#f59e0b",
  implante: "#0d9488",
  ausente: "#525252",
  sellante: "#22c55e",
  fractura: "#ea580c",
  protesis: "#a855f7",
};

/**
 * Condiciones que solo tienen sentido a nivel de pieza completa (no por
 * superficie). La UI restringe la elección al ver "whole" seleccionada.
 */
export const WHOLE_TOOTH_CONDITIONS: readonly ToothCondition[] = [
  "ausente",
  "implante",
  "corona",
  "protesis",
];

/**
 * Numeración FDI (ISO 3950). Cuadrantes 1-4 permanentes; 5-8 primarios.
 * Cada cuadrante va 1-8 desde el incisivo central hasta el tercer molar.
 * Devuelve los cuadrantes ordenados para renderizar el layout dental clásico:
 *  17 16 15 14 13 12 11 | 21 22 23 24 25 26 27 28    (arriba, vista frontal)
 *  47 46 45 44 43 42 41 | 31 32 33 34 35 36 37 38    (abajo)
 */
export const FDI_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11] as const;
export const FDI_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28] as const;
export const FDI_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38] as const;
export const FDI_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41] as const;

export const FDI_ALL_ADULT = [
  ...FDI_UPPER_RIGHT,
  ...FDI_UPPER_LEFT,
  ...FDI_LOWER_RIGHT,
  ...FDI_LOWER_LEFT,
] as const;

/**
 * Dentición temporal (odontopediatría): cuadrantes 5-8, 5 piezas cada uno
 * (sin molares permanentes). Mismo patrón FDI, mismas condiciones y misma
 * tabla odontogram_marks — el CHECK de rango ya lo permite desde que se creó
 * el odontograma, solo faltaba exponerlo en la UI.
 */
export const FDI_UPPER_RIGHT_PRIMARY = [55, 54, 53, 52, 51] as const;
export const FDI_UPPER_LEFT_PRIMARY = [61, 62, 63, 64, 65] as const;
export const FDI_LOWER_LEFT_PRIMARY = [71, 72, 73, 74, 75] as const;
export const FDI_LOWER_RIGHT_PRIMARY = [85, 84, 83, 82, 81] as const;

export const FDI_ALL_PRIMARY = [
  ...FDI_UPPER_RIGHT_PRIMARY,
  ...FDI_UPPER_LEFT_PRIMARY,
  ...FDI_LOWER_RIGHT_PRIMARY,
  ...FDI_LOWER_LEFT_PRIMARY,
] as const;

export interface OdontogramMark {
  id: string;
  toothNumber: number;
  surface: ToothSurface;
  condition: ToothCondition;
  material: string | null;
  notes: string | null;
  supersededAt: string | null;
  recordedAt: string;
  recordedById: string;
  recordedByName: string | null;
}

export type ToothState = Partial<Record<ToothSurface, OdontogramMark>>;

/** Agrupa las marcas vigentes por número de pieza, y por superficie dentro. */
export function marksByTooth(marks: OdontogramMark[]): Map<number, ToothState> {
  const map = new Map<number, ToothState>();
  for (const mark of marks) {
    if (mark.supersededAt) continue;
    const tooth = map.get(mark.toothNumber) ?? {};
    tooth[mark.surface] = mark;
    map.set(mark.toothNumber, tooth);
  }
  return map;
}
