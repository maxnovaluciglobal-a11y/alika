import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { permissionsForRole, type ClinicRole } from "@/lib/access";
import { mensajeDb } from "@/lib/db-errors";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const SIN_ASIGNAR = "sin_asignar";

/**
 * security-review 01-sep: `treatment_items_select_members`/`payments_select_finance_roles`
 * dejan leer a cualquier miembro de la clínica (incluida `reception`, que no
 * tiene `finance:view`) — RLS por sí sola no alcanza acá. Mismo criterio que
 * ya usa `getCommissionReport` para el mismo tipo de gap. A diferencia de
 * comisiones (que sí tiene sentido acotar a "lo propio"), un reporte de caja
 * no tiene una versión "propia" con sentido para un rol sin `finance:view` —
 * la respuesta correcta es negar, no degradar en silencio.
 */
export async function requireFinanceView(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  userId: string,
) {
  const { data: membership } = await supabase
    .from("clinic_members")
    .select("role")
    .eq("clinic_id", clinicId)
    .eq("user_id", userId)
    .maybeSingle();
  const canView = membership?.role
    ? permissionsForRole(membership.role as ClinicRole).includes("finance:view")
    : false;
  if (!canView) throw new Error("No tienes permisos para ver los reportes financieros.");
}

export interface FinanceSummary {
  currency: string;
  totalCents: number;
  paymentsCount: number;
  averageTicketCents: number;
  byDay: { date: string; totalCents: number }[];
  byMethod: { method: string; totalCents: number; count: number }[];
  byProfessional: {
    professionalId: string;
    professionalName: string;
    totalCents: number;
    itemsCount: number;
  }[];
  /**
   * Lo que efectivamente entró tras la retención de los medios de pago (G-6).
   * `null` cuando ningún pago del período tiene `net_cents` — es decir, todos
   * son anteriores a los medios configurables. No se asume que neto = bruto:
   * eso escondería justamente la comisión que este número existe para mostrar.
   */
  netCents: number | null;
  /** Retención total del período. `null` por la misma razón que `netCents`. */
  retentionCents: number | null;
  /** Gastos del período (`expenses.incurred_on` dentro del rango). */
  expensesCents: number;
  expensesCount: number;
  byExpenseCategory: { category: string; totalCents: number; count: number }[];
  /**
   * Resultado del período: lo que entró menos lo que salió. Usa el neto
   * cuando hay dato de retención y el bruto cuando no — la alternativa sería
   * no mostrar resultado hasta que la clínica configure retenciones, y eso
   * deja el módulo sin su número más útil.
   */
  resultCents: number;
}

/**
 * Caja + producción del período. Dos fuentes distintas a propósito:
 *  - "cobrado" viene de `payments` (plata que realmente entró).
 *  - "producción por profesional" viene de `treatment_items` completados,
 *    no de payments — payments no tiene professional_id, y un pago no
 *    siempre corresponde 1:1 a un ítem. Es el mismo indicador que usa el
 *    rubro (Dentalink, etc.) para "cuánto trabajo entregó cada doctor/a",
 *    no necesariamente lo que ya se cobró.
 *
 * Mismo criterio de fecha que compliance.functions.ts::getComplianceLog:
 * desde/hasta son YYYY-MM-DD, se interpretan como límites UTC del día, sin
 * ajustar a la timezone de la sucursal (simplificación ya usada en el resto
 * del proyecto para filtros de rango de fecha).
 */
export const getFinanceSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<FinanceSummary> => {
    const { supabase, userId } = context;
    await requireFinanceView(supabase, data.clinicId, userId);
    const desdeIso = `${data.desde}T00:00:00.000Z`;
    const hastaIso = `${data.hasta}T23:59:59.999Z`;

    const { data: pagos, error } = await supabase
      .from("payments")
      .select("amount_cents, currency, method, method_name_snapshot, net_cents, paid_at")
      .eq("clinic_id", data.clinicId)
      .gte("paid_at", desdeIso)
      .lte("paid_at", hastaIso);
    if (error) throw new Error(mensajeDb(error, "No pudimos cargar los pagos del período."));

    const rows = pagos ?? [];
    const currency = rows[0]?.currency ?? "CLP";
    const totalCents = rows.reduce((s, p) => s + p.amount_cents, 0);
    const paymentsCount = rows.length;
    const averageTicketCents = paymentsCount ? Math.round(totalCents / paymentsCount) : 0;

    const byDayMap = new Map<string, number>();
    for (const p of rows) {
      const day = p.paid_at.slice(0, 10);
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + p.amount_cents);
    }
    const byDay = [...byDayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayTotalCents]) => ({ date, totalCents: dayTotalCents }));

    // Agrupa por el nombre configurado cuando el pago lo tiene (G-6) y cae al
    // valor del enum para los pagos viejos: así "Tarjeta de crédito" y
    // "credit_card" no aparecen como dos filas distintas si la clínica no
    // renombró el medio, pero un "Klap - Crédito" propio se ve con su nombre.
    const byMethodMap = new Map<string, { totalCents: number; count: number }>();
    for (const p of rows) {
      const clave = p.method_name_snapshot ?? p.method;
      const cur = byMethodMap.get(clave) ?? { totalCents: 0, count: 0 };
      cur.totalCents += p.amount_cents;
      cur.count += 1;
      byMethodMap.set(clave, cur);
    }

    // Neto y retención: solo sobre los pagos que TIENEN net_cents. Si ninguno
    // lo tiene, ambos quedan null y la UI no promete un neto que no calculó.
    const conNeto = rows.filter((p) => p.net_cents !== null);
    const netCents = conNeto.length
      ? conNeto.reduce((sum, p) => sum + (p.net_cents ?? 0), 0) +
        rows.filter((p) => p.net_cents === null).reduce((sum, p) => sum + p.amount_cents, 0)
      : null;
    const retentionCents = netCents === null ? null : totalCents - netCents;
    const byMethod = [...byMethodMap.entries()]
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.totalCents - a.totalCents);

    const { data: items, error: itemsError } = await supabase
      .from("treatment_items")
      .select("price_cents, professional_id, completed_at")
      .eq("clinic_id", data.clinicId)
      .eq("status", "completed")
      .gte("completed_at", desdeIso)
      .lte("completed_at", hastaIso);
    if (itemsError)
      throw new Error(mensajeDb(itemsError, "No pudimos cargar la producción del período."));

    const professionalIds = [
      ...new Set(
        (items ?? []).map((i) => i.professional_id).filter((id): id is string => Boolean(id)),
      ),
    ];
    const { data: professionals, error: profError } = await supabase
      .from("professionals")
      .select("id, full_name")
      .in("id", professionalIds.length ? professionalIds : [""]);
    if (profError)
      throw new Error(mensajeDb(profError, "No pudimos cargar los datos de los profesionales."));
    const nameById = new Map((professionals ?? []).map((p) => [p.id, p.full_name]));

    const byProfMap = new Map<string, { totalCents: number; itemsCount: number }>();
    for (const it of items ?? []) {
      const key = it.professional_id ?? SIN_ASIGNAR;
      const cur = byProfMap.get(key) ?? { totalCents: 0, itemsCount: 0 };
      cur.totalCents += it.price_cents;
      cur.itemsCount += 1;
      byProfMap.set(key, cur);
    }
    const byProfessional = [...byProfMap.entries()]
      .map(([professionalId, v]) => ({
        professionalId,
        professionalName:
          professionalId === SIN_ASIGNAR ? "Sin asignar" : (nameById.get(professionalId) ?? "—"),
        ...v,
      }))
      .sort((a, b) => b.totalCents - a.totalCents);

    // Gastos del período. `incurred_on` es `date`, así que el filtro usa las
    // fechas tal cual, sin fabricar límites UTC como sí hace `payments` con su
    // `timestamptz` — un gasto pertenece a un día contable, no a un instante.
    const { data: gastos, error: gastosError } = await supabase
      .from("expenses")
      .select("amount_cents, category")
      .eq("clinic_id", data.clinicId)
      .gte("incurred_on", data.desde)
      .lte("incurred_on", data.hasta);
    if (gastosError)
      throw new Error(mensajeDb(gastosError, "No pudimos cargar los gastos del período."));

    const gastoRows = gastos ?? [];
    const expensesCents = gastoRows.reduce((sum, g) => sum + g.amount_cents, 0);

    const byCategoryMap = new Map<string, { totalCents: number; count: number }>();
    for (const g of gastoRows) {
      const cur = byCategoryMap.get(g.category) ?? { totalCents: 0, count: 0 };
      cur.totalCents += g.amount_cents;
      cur.count += 1;
      byCategoryMap.set(g.category, cur);
    }
    const byExpenseCategory = [...byCategoryMap.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.totalCents - a.totalCents);

    return {
      currency,
      totalCents,
      paymentsCount,
      averageTicketCents,
      byDay,
      byMethod,
      byProfessional,
      netCents,
      retentionCents,
      expensesCents,
      expensesCount: gastoRows.length,
      byExpenseCategory,
      resultCents: (netCents ?? totalCents) - expensesCents,
    };
  });

export interface QuoteConversionReport {
  currency: string;
  /** Presupuestos creados (en cualquier estado) con created_at en el rango. */
  created: number;
  accepted: number;
  rejected: number;
  /** sent | expired | draft que no terminaron aceptados ni rechazados. */
  pending: number;
  /** accepted / (accepted + rejected), en % (0-100). null si no hay resueltos. */
  conversionRate: number | null;
  acceptedTotalCents: number;
  createdTotalCents: number;
}

/**
 * Conversión de presupuestos del período (reporte ampliado, Tier 3-L). Mira
 * quotes por created_at en el rango y clasifica por estado actual. La tasa de
 * conversión es sobre los que ya se resolvieron (aceptado vs rechazado), no
 * sobre el total — un presupuesto todavía "sent" no cuenta como perdido.
 * Mismo criterio de fecha UTC que getFinanceSummary.
 */
export const getQuoteConversionReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<QuoteConversionReport> => {
    await requireFinanceView(context.supabase, data.clinicId, context.userId);
    const desdeIso = `${data.desde}T00:00:00.000Z`;
    const hastaIso = `${data.hasta}T23:59:59.999Z`;

    const { data: quotes, error } = await context.supabase
      .from("quotes")
      .select("status, total_cents, currency, created_at")
      .eq("clinic_id", data.clinicId)
      .gte("created_at", desdeIso)
      .lte("created_at", hastaIso);
    if (error) throw new Error(mensajeDb(error, "No pudimos cargar los presupuestos del período."));

    const rows = quotes ?? [];
    const currency = rows[0]?.currency ?? "CLP";
    let accepted = 0;
    let rejected = 0;
    let pending = 0;
    let acceptedTotalCents = 0;
    let createdTotalCents = 0;
    for (const q of rows) {
      createdTotalCents += q.total_cents ?? 0;
      // 'converted' = aceptado y ya convertido en plan; cuenta como aceptado.
      if (q.status === "accepted" || q.status === "converted") {
        accepted += 1;
        acceptedTotalCents += q.total_cents ?? 0;
      } else if (q.status === "rejected") {
        rejected += 1;
      } else {
        pending += 1;
      }
    }
    const resolved = accepted + rejected;
    const conversionRate = resolved > 0 ? Math.round((accepted / resolved) * 100) : null;

    return {
      currency,
      created: rows.length,
      accepted,
      rejected,
      pending,
      conversionRate,
      acceptedTotalCents,
      createdTotalCents,
    };
  });
