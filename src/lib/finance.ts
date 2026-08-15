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

export const PAYMENT_METHODS = ["cash", "debit_card", "credit_card", "transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  debit_card: "Tarjeta débito",
  credit_card: "Tarjeta crédito",
  transfer: "Transferencia",
  other: "Otro",
};

export interface Payment {
  id: string;
  amountCents: number;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  paidAt: string;
  notes: string | null;
  treatmentPlanId: string | null;
  treatmentItemId: string | null;
  createdById: string;
}

/**
 * Saldo del paciente calculado en runtime desde treatment_items vs payments.
 * `totalBilledCents` = suma de precios de todos los ítems (pending o no).
 * `totalPaidCents` = suma de todos los pagos del paciente.
 * `balanceCents` = billed − paid. Positivo = paciente debe. Negativo = crédito.
 */
export interface PatientBalance {
  totalBilledCents: number;
  totalPaidCents: number;
  balanceCents: number;
  currency: string;
}

/**
 * Monedas ISO 4217 sin subunidades (o con subunidad no cotidiana). Para
 * estas guardamos "cents" = unidad entera. Para el resto, cents = 1/100
 * de la unidad. Fuente: la tabla de currency exponent de ISO. Los que
 * importan para LatAm y adyacentes son CLP, PYG, COP, VND, JPY, KRW.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "CLP",
  "PYG",
  "COP",
  "VND",
  "JPY",
  "KRW",
  "CLF",
  "BIF",
  "DJF",
  "GNF",
  "ISK",
  "KMF",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

function centsFactor(currency: string) {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
}

/** Formato de moneda. Respeta currency del quote/plan/payment. */
export function formatMoney(cents: number, currency = "CLP"): string {
  const isZeroDec = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency,
    maximumFractionDigits: isZeroDec ? 0 : 2,
  }).format(cents / centsFactor(currency));
}

export function toCents(pesos: number, currency = "CLP"): number {
  return Math.round(pesos * centsFactor(currency));
}
export function fromCents(cents: number, currency = "CLP"): number {
  return cents / centsFactor(currency);
}
