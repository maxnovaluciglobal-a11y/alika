/**
 * Periodontograma: estándar clínico ampliamente aceptado (Academia Americana
 * de Periodoncia — AAP — y equivalentes LatAm). 6 puntos por pieza para
 * profundidad de sondaje (PD), sangrado al sondaje (BOP) y recesión gingival;
 * movilidad (Miller) y furca a nivel de pieza completa.
 */

export const PERIODONTAL_POINTS = ["mv", "v", "dv", "ml", "l", "dl"] as const;
export type PeriodontalPoint = (typeof PERIODONTAL_POINTS)[number];

/** Incluye "whole" — usado solo para mobility/furcation, nunca para PD/BOP/recesión. */
export const PERIODONTAL_POINTS_ALL = [...PERIODONTAL_POINTS, "whole"] as const;
export type PeriodontalPointAll = (typeof PERIODONTAL_POINTS_ALL)[number];

export const POINT_LABELS: Record<PeriodontalPoint, string> = {
  mv: "Mesio-vestibular",
  v: "Vestibular",
  dv: "Disto-vestibular",
  ml: "Mesio-lingual",
  l: "Lingual",
  dl: "Disto-lingual",
};

export const MOBILITY_LABELS: Record<number, string> = {
  0: "0 · sin movilidad",
  1: "1 · leve (<1mm horizontal)",
  2: "2 · moderada (1-2mm horizontal)",
  3: "3 · severa (>2mm o vertical)",
};

export const FURCATION_LABELS: Record<number, string> = {
  0: "0 · sin compromiso",
  1: "I · incipiente (<1/3)",
  2: "II · parcial (>1/3, no through-and-through)",
  3: "III · total (through-and-through)",
};

/** Molares FDI: cuadrantes terminados en 6, 7, 8 (permanentes) — donde aplica furca. */
export function isMolar(toothNumber: number): boolean {
  const lastDigit = toothNumber % 10;
  return lastDigit >= 6 && lastDigit <= 8;
}

export const FDI_ADULT_QUADRANTS = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
} as const;

export interface PeriodontalPointMeasurement {
  point: PeriodontalPoint;
  pocketDepthMm: number | null;
  bleeding: boolean | null;
  recessionMm: number | null;
}

export interface PeriodontalToothMeasurement {
  toothNumber: number;
  points: PeriodontalPointMeasurement[];
  mobility: number | null;
  furcation: number | null;
}

export interface PeriodontalChart {
  id: string;
  patientId: string;
  notes: string | null;
  recordedById: string;
  recordedByName: string | null;
  recordedAt: string;
  teeth: PeriodontalToothMeasurement[];
}

export interface PeriodontalChartSummary {
  id: string;
  notes: string | null;
  recordedById: string;
  recordedByName: string | null;
  recordedAt: string;
  /** Cantidad de piezas con al menos una medición — para listar el historial sin traer todo el detalle. */
  teethCount: number;
  /** Máxima profundidad de sondaje registrada en el chart — indicador rápido de severidad. */
  maxPocketDepthMm: number | null;
  /** Cuántos de los puntos con dato tuvieron sangrado — indicador rápido de inflamación activa. */
  bleedingSitesCount: number;
}

/** Clasificación clínica de severidad por profundidad de bolsa (referencia AAP). */
export function pocketSeverity(
  mm: number | null,
): "normal" | "leve" | "moderada" | "severa" | null {
  if (mm == null) return null;
  if (mm <= 3) return "normal";
  if (mm <= 5) return "leve";
  if (mm <= 6) return "moderada";
  return "severa";
}

export const SEVERITY_COLORS: Record<"normal" | "leve" | "moderada" | "severa", string> = {
  normal: "#22c55e",
  leve: "#f59e0b",
  moderada: "#ea580c",
  severa: "#dc2626",
};
