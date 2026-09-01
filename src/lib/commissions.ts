export type CommissionKind = "percent" | "fixed";

/** Solo los montos de la regla — la versión con professionalId vive en commissions.functions.ts. */
export interface CommissionRuleAmounts {
  kind: CommissionKind;
  percentBps: number;
  fixedCents: number;
}

/**
 * Cálculo puro de una liquidación de comisión, extraído de
 * `commissions.functions.ts` para poder testearlo sin base de datos
 * (auditoría de deuda técnica, 30-ago — el cálculo vivía inline dentro del
 * handler del server fn, sin ningún test).
 *
 * "percent": redondea (no trunca) los basis points sobre la producción —
 * evita perder centavos sistemáticamente en contra del profesional.
 * "fixed": monto fijo por procedimiento completado, multiplicado por el
 * conteo — no depende de la producción en pesos.
 */
export function calcularComision(
  rule: CommissionRuleAmounts | null,
  productionCents: number,
  procedureCount: number,
): { commissionCents: number | null; ruleLabel: string } {
  if (!rule) return { commissionCents: null, ruleLabel: "Sin regla configurada" };
  if (rule.kind === "percent") {
    return {
      commissionCents: Math.round((productionCents * rule.percentBps) / 10000),
      ruleLabel: `${(rule.percentBps / 100).toFixed(2)}% sobre producción`,
    };
  }
  return {
    commissionCents: rule.fixedCents * procedureCount,
    ruleLabel: `Fijo por procedimiento`,
  };
}
