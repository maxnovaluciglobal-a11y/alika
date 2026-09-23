export const ORTHO_CASE_KINDS = ["brackets", "aligners"] as const;
export type OrthoCaseKind = (typeof ORTHO_CASE_KINDS)[number];

export const ORTHO_CASE_KIND_LABELS: Record<OrthoCaseKind, string> = {
  brackets: "Brackets",
  aligners: "Alineadores",
};

export const ORTHO_CASE_STATUSES = ["active", "on_hold", "completed", "cancelled"] as const;
export type OrthoCaseStatus = (typeof ORTHO_CASE_STATUSES)[number];

export const ORTHO_CASE_STATUS_LABELS: Record<OrthoCaseStatus, string> = {
  active: "Activo",
  on_hold: "En pausa",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

export interface OrthoCase {
  id: string;
  patientId: string;
  patientName: string;
  professionalId: string | null;
  treatmentPlanId: string | null;
  kind: OrthoCaseKind;
  status: OrthoCaseStatus;
  startedOn: string;
  expectedEndOn: string | null;
  currency: string;
  /** `null` = sin cuota fija definida (no todos los casos cobran mensual). */
  monthlyFeeCents: number | null;
  notes: string | null;
  /** Fecha del último control registrado, o `null` si nunca tuvo uno. */
  lastControlOn: string | null;
}

export interface OrthoControl {
  id: string;
  orthoCaseId: string;
  controlDate: string;
  attended: boolean;
  paymentId: string | null;
  notes: string | null;
}

/**
 * Un caso "sin control hace meses" es exactamente el que la auditoría
 * describe como el que "aparece solo, antes de convertirse en un caso
 * abandonado" (deck de SuperClini). 45 días es más laxo que un control
 * mensual estricto — dental suele correr controles cada 4-6 semanas.
 */
const DIAS_SIN_CONTROL_ALERTA = 45;

export function controlAtrasado(caso: OrthoCase, hoyIso: string): boolean {
  if (caso.status !== "active") return false;
  const referencia = caso.lastControlOn ?? caso.startedOn;
  const dias = Math.floor(
    (new Date(hoyIso).getTime() - new Date(referencia).getTime()) / (1000 * 60 * 60 * 24),
  );
  return dias >= DIAS_SIN_CONTROL_ALERTA;
}
