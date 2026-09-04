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
  /** Si es false, la UI no deja descontar esta prestación en el presupuesto. */
  allowsDiscount: boolean;
  /** Valor referencial declarado ante convenios. `null` = sin dato, no cero. */
  referencePriceCents: number | null;
  /** Costo de laboratorio. `null` = sin dato, no cero. */
  labCostCents: number | null;
  position: number;
}

/**
 * Medio de pago configurable por clínica (G-6). Reemplaza al enum fijo para
 * lo nuevo, sin borrarlo: `Payment.method` sigue existiendo para el histórico.
 */
export interface PaymentMethodConfig {
  id: string;
  name: string;
  /** Comisión que retiene el operador, 0-100. El paciente paga el total igual. */
  retentionPct: number;
  allowsRefund: boolean;
  isActive: boolean;
  position: number;
  /** Valor del enum viejo al que equivale, si equivale a alguno. */
  legacyKey: PaymentMethod | null;
}

/** Neto que le queda a la clínica tras la retención del medio de pago. */
export function netAfterRetention(amountCents: number, retentionPct: number): number {
  if (retentionPct <= 0) return amountCents;
  return Math.max(0, amountCents - Math.round((amountCents * retentionPct) / 100));
}

export interface Expense {
  id: string;
  branchId: string | null;
  category: string;
  description: string;
  supplier: string | null;
  amountCents: number;
  currency: string;
  paymentMethodId: string | null;
  methodNameSnapshot: string | null;
  /** Día contable del gasto (YYYY-MM-DD), no un instante. */
  incurredOn: string;
  notes: string | null;
  createdAt: string;
}

/**
 * Categorías sugeridas para el primer gasto de una clínica. NO es un catálogo
 * cerrado: `expenses.category` es texto libre y la UI ofrece además las que la
 * clínica ya viene usando.
 */
export const CATEGORIAS_GASTO_SUGERIDAS = [
  "Arriendo",
  "Sueldos",
  "Insumos clínicos",
  "Laboratorio",
  "Servicios básicos",
  "Marketing",
  "Equipamiento",
  "Mantención",
  "Impuestos",
  "Otros",
] as const;

export interface QuoteItem {
  id: string;
  procedureId: string | null;
  nameSnapshot: string;
  toothNumber: number | null;
  surface: ToothSurface | null;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  /**
   * Descuento negociado en % del que se derivó `discountCents`. `null` cuando
   * el descuento se cargó directamente en pesos — no es un 0, es "no aplica"
   * (regla 11). La verdad contable siempre es `discountCents`.
   */
  discountPct: number | null;
  totalCents: number;
  /** Bloque que agrupa el ítem ("Fase 1", "Rehabilitación"). `null` = sin fase. */
  phaseLabel: string | null;
  phasePosition: number;
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
  /** Descuento comercial global en %. `null` = se cargó en pesos o no hay. */
  commercialDiscountPct: number | null;
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
  /** Heredado del `quote_item` al aceptar el presupuesto. `null` = sin fase. */
  phaseLabel: string | null;
  phasePosition: number;
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

/** Etiqueta del bloque implícito que junta los ítems sin fase asignada. */
export const SIN_FASE_LABEL = "Sin fase";

export interface PhaseGroup<T> {
  /** `null` para el bloque implícito de ítems sin fase. */
  label: string | null;
  phasePosition: number;
  items: T[];
  subtotalCents: number;
}

/**
 * Agrupa ítems de presupuesto o de plan en bloques por `phaseLabel`, para
 * renderizar el subtotal por fase que espera un dentista (G-2).
 *
 * Agrupa por `phaseLabel` y no por `phasePosition` a propósito: la etiqueta es
 * lo que el usuario escribió y lo que ve, y dos ítems con el mismo nombre de
 * fase tienen que caer juntos aunque sus `phase_position` se hayan desfasado
 * por una edición. La posición solo ordena los bloques entre sí.
 *
 * Los ítems sin fase salen siempre primero — es el equivalente de la "Sección
 * sin nombre" de Dentalink, donde vive lo que se cargó antes de que existieran
 * las fases y lo que no pertenece a ninguna etapa.
 */
export function groupByPhase<
  T extends { phaseLabel: string | null; phasePosition: number; position: number },
>(items: T[], amount: (item: T) => number): PhaseGroup<T>[] {
  // Clave `string | null`: un Map de JS acepta null como clave, así que el
  // bloque sin fase no necesita un centinela de texto que podría colisionar
  // con una fase que la clínica llame igual.
  const groups = new Map<string | null, PhaseGroup<T>>();

  for (const item of items) {
    const key = item.phaseLabel;
    let group = groups.get(key);
    if (!group) {
      group = {
        label: item.phaseLabel,
        // Los sin-fase se fuerzan al principio; el resto respeta lo guardado.
        phasePosition: item.phaseLabel === null ? -1 : item.phasePosition,
        items: [],
        subtotalCents: 0,
      };
      groups.set(key, group);
    }
    group.items.push(item);
    group.subtotalCents += amount(item);
  }

  const ordered = [...groups.values()].sort(
    (a, b) => a.phasePosition - b.phasePosition || (a.label ?? "").localeCompare(b.label ?? ""),
  );
  for (const group of ordered) group.items.sort((a, b) => a.position - b.position);
  return ordered;
}

/** Estado de cobro de un ítem del plan, para el semáforo por línea (G-5). */
export type ItemPaymentState = "unpaid" | "partial" | "paid";

export const ITEM_PAYMENT_LABELS: Record<ItemPaymentState, string> = {
  unpaid: "Sin pagos imputados",
  partial: "Pago parcial",
  paid: "Pagado",
};

/**
 * Cuánto se pagó de cada ítem del plan, mirando `payments.treatment_item_id`.
 * Devuelve cents por id de ítem; un ítem ausente del mapa no tiene pagos.
 *
 * Solo cuenta los pagos imputados a un ítem concreto: un pago suelto contra el
 * plan entero no se prorratea entre las líneas, porque repartirlo inventaría
 * una imputación que nadie hizo y el semáforo mentiría. Un plan cobrado
 * globalmente muestra todas sus líneas en "Sin pagos imputados", que es la
 * verdad — el saldo real del paciente sigue estando en el encabezado de la
 * ficha, calculado server-side sobre el total.
 */
export function paidCentsByItem(payments: Payment[]): Map<string, number> {
  const paidByItem = new Map<string, number>();
  for (const payment of payments) {
    if (!payment.treatmentItemId) continue;
    paidByItem.set(
      payment.treatmentItemId,
      (paidByItem.get(payment.treatmentItemId) ?? 0) + payment.amountCents,
    );
  }
  return paidByItem;
}

/** Resuelve el semáforo de un ítem contra lo que se le imputó. */
export function itemPaymentState(paidCents: number, priceCents: number): ItemPaymentState {
  if (paidCents <= 0) return "unpaid";
  return paidCents >= priceCents ? "paid" : "partial";
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
