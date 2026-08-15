import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SIN_ASIGNAR = "sin_asignar";

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
    const { supabase } = context;
    const desdeIso = `${data.desde}T00:00:00.000Z`;
    const hastaIso = `${data.hasta}T23:59:59.999Z`;

    const { data: pagos, error } = await supabase
      .from("payments")
      .select("amount_cents, currency, method, paid_at")
      .eq("clinic_id", data.clinicId)
      .gte("paid_at", desdeIso)
      .lte("paid_at", hastaIso);
    if (error) throw new Error(error.message);

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

    const byMethodMap = new Map<string, { totalCents: number; count: number }>();
    for (const p of rows) {
      const cur = byMethodMap.get(p.method) ?? { totalCents: 0, count: 0 };
      cur.totalCents += p.amount_cents;
      cur.count += 1;
      byMethodMap.set(p.method, cur);
    }
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
    if (itemsError) throw new Error(itemsError.message);

    const professionalIds = [
      ...new Set(
        (items ?? []).map((i) => i.professional_id).filter((id): id is string => Boolean(id)),
      ),
    ];
    const { data: professionals, error: profError } = await supabase
      .from("professionals")
      .select("id, full_name")
      .in("id", professionalIds.length ? professionalIds : [""]);
    if (profError) throw new Error(profError.message);
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

    return {
      currency,
      totalCents,
      paymentsCount,
      averageTicketCents,
      byDay,
      byMethod,
      byProfessional,
    };
  });
