export const CASH_REGISTER_STATUSES = ["open", "closed"] as const;
export type CashRegisterStatus = (typeof CASH_REGISTER_STATUSES)[number];

export const CASH_REGISTER_STATUS_LABELS: Record<CashRegisterStatus, string> = {
  open: "Abierta",
  closed: "Cerrada",
};

/**
 * Sesión de caja por turno. `expectedClosingCents`/`declaredClosingCents`/
 * `differenceCents` son `null` mientras está abierta — se llenan una sola
 * vez al cerrar y no se recalculan después (snapshot, regla 10 de CLAUDE.md).
 */
export interface CashRegister {
  id: string;
  clinicId: string;
  branchId: string | null;
  status: CashRegisterStatus;
  currency: string;
  openingAmountCents: number;
  openedById: string;
  openedAt: string;
  openingNotes: string | null;
  expectedClosingCents: number | null;
  declaredClosingCents: number | null;
  differenceCents: number | null;
  closedById: string | null;
  closedAt: string | null;
  closingNotes: string | null;
}

/** Desglose de lo cobrado durante una sesión de caja, por medio de pago. */
export interface CashRegisterMethodBreakdown {
  method: string;
  amountCents: number;
  count: number;
}

/**
 * Lo esperado en caja al momento de cerrar: monto de apertura + lo cobrado
 * durante la sesión. Pura para poder testearla sin pegarle a la base.
 */
export function esperadoEnCaja(openingAmountCents: number, cobradoCents: number): number {
  return openingAmountCents + cobradoCents;
}

/** Diferencia entre lo contado por el cajero y lo esperado. Positivo = sobra. */
export function diferenciaDeArqueo(declaredCents: number, expectedCents: number): number {
  return declaredCents - expectedCents;
}
