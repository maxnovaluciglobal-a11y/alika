import type { ToothSurface } from "@/lib/odontogram";

export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "converted",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Borrador",
  sent: "Enviado",
  accepted: "Aceptado",
  rejected: "Rechazado",
  expired: "Vencido",
  converted: "Convertido en plan",
};

export const TREATMENT_PLAN_STATUSES = ["active", "on_hold", "completed", "cancelled"] as const;
export type TreatmentPlanStatus = (typeof TREATMENT_PLAN_STATUSES)[number];

export const TREATMENT_PLAN_STATUS_LABELS: Record<TreatmentPlanStatus, string> = {
  active: "Activo",
  on_hold: "En pausa",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

export const TREATMENT_ITEM_STATUSES = ["pending", "in_progress", "completed", "skipped"] as const;
export type TreatmentItemStatus = (typeof TREATMENT_ITEM_STATUSES)[number];

export const TREATMENT_ITEM_STATUS_LABELS: Record<TreatmentItemStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Realizado",
  skipped: "Omitido",
};

export interface Procedure {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  defaultPriceCents: number;
  currency: string;
  durationMin: number | null;
  isActive: boolean;
}

export interface QuoteItem {
  id: string;
  procedureId: string | null;
  nameSnapshot: string;
  toothNumber: number | null;
  surface: ToothSurface | null;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  totalCents: number;
  position: number;
  notes: string | null;
}

export interface Quote {
  id: string;
  number: string;
  status: QuoteStatus;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  notes: string | null;
  validUntil: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  acceptedByName: string | null;
  createdAt: string;
  items: QuoteItem[];
}

export interface TreatmentItem {
  id: string;
  procedureId: string | null;
  quoteItemId: string | null;
  nameSnapshot: string;
  toothNumber: number | null;
  surface: ToothSurface | null;
  status: TreatmentItemStatus;
  priceCents: number;
  position: number;
  professionalId: string | null;
  scheduledAppointmentId: string | null;
  completedAt: string | null;
  notes: string | null;
}

export interface TreatmentPlan {
  id: string;
  quoteId: string | null;
  name: string;
  status: TreatmentPlanStatus;
  totalCents: number;
  currency: string;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  items: TreatmentItem[];
}

/** Formato de moneda (defaults a CLP; respeta currency del quote/plan). */
export function formatMoney(cents: number, currency = "CLP"): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / (currency === "CLP" ? 1 : 100));
}

/**
 * Números CLP se guardan sin decimales (pesos enteros). Otras monedas de
 * LatAm suelen usar 2 decimales — dejamos el helper preparado para cuando
 * agreguemos MXN/PEN/COP.
 */
export function toCents(pesos: number, currency = "CLP"): number {
  return Math.round(pesos * (currency === "CLP" ? 1 : 100));
}
export function fromCents(cents: number, currency = "CLP"): number {
  return cents / (currency === "CLP" ? 1 : 100);
}
