import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CommissionKind = "percent" | "fixed";

export type CommissionRule = {
  professionalId: string;
  kind: CommissionKind;
  /** Basis points (1% = 100). Solo relevante si kind='percent'. */
  percentBps: number;
  /** Cents por procedimiento completado. Solo relevante si kind='fixed'. */
  fixedCents: number;
};

/** Reglas de comisión de todos los profesionales de la clínica. Sin fila para
 * un profesional = sin comisión configurada (no aparece o comisión 0). */
export const listCommissionRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<CommissionRule[]> => {
    const { data: rows, error } = await context.supabase
      .from("commission_rules")
      .select("professional_id, kind, percent_bps, fixed_cents")
      .eq("clinic_id", data.clinicId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      professionalId: r.professional_id,
      kind: r.kind as CommissionKind,
      percentBps: r.percent_bps,
      fixedCents: r.fixed_cents,
    }));
  });

export const setCommissionRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        professionalId: z.string().uuid(),
        kind: z.enum(["percent", "fixed"]),
        percentBps: z.number().int().min(0).max(10000),
        fixedCents: z.number().int().min(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("commission_rules").upsert(
      {
        clinic_id: data.clinicId,
        professional_id: data.professionalId,
        kind: data.kind,
        percent_bps: data.percentBps,
        fixed_cents: data.fixedCents,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clinic_id,professional_id" },
    );
    if (error) throw new Error("No tienes permisos para editar las comisiones.");
    return { ok: true };
  });

export const removeCommissionRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ clinicId: z.string().uuid(), professionalId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("commission_rules")
      .delete()
      .eq("clinic_id", data.clinicId)
      .eq("professional_id", data.professionalId);
    if (error) throw new Error("No tienes permisos para editar las comisiones.");
    return { ok: true };
  });

export type CommissionLine = {
  professionalId: string;
  professionalName: string;
  kind: CommissionKind | null;
  /** Producción del período (suma de price_cents de items completados). */
  productionCents: number;
  procedureCount: number;
  /** Comisión calculada con la regla vigente. null = sin regla configurada. */
  commissionCents: number | null;
  ruleLabel: string;
  /** true = este período ya fue cerrado, el monto es un snapshot congelado
   * (no se recalcula aunque cambie commission_rules después). */
  closed: boolean;
  /** Solo tiene sentido si closed=true. */
  paidAt: string | null;
  /** id de `commission_settlements`. Solo tiene sentido si closed=true —
   * lo necesita `markCommissionSettlementPaid`. */
  settlementId: string | null;
};

/** 42P01 = undefined_table (Postgres). La migración de commission_settlements
 * (auditoría 360 v2, 26-ago) puede no estar aplicada todavía — degradar a
 * "sin períodos cerrados" en vez de romper el reporte completo. */
function isUndefinedTableError(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/**
 * Liquidación de comisiones por profesional en un rango [from, to] (fechas
 * civiles YYYY-MM-DD, inclusive). Si el período [from,to] para un profesional
 * ya fue cerrado (`commission_settlements`), devuelve el snapshot congelado
 * en vez de recalcular — así una regla editada después de cerrar no altera
 * lo ya liquidado/comunicado (auditoría 360 v2, arq-1/arq-8/ops-9). Para
 * cualquier rango sin cierre, sigue calculando en vivo con la regla vigente.
 * `professionalId` opcional filtra a un solo profesional — ux-3: el propio
 * profesional solo debe ver su línea, nunca la de sus colegas.
 */
export const getCommissionReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        professionalId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<CommissionLine[]> => {
    // completed_at es timestamptz; el rango civil [from 00:00, to 24:00).
    const fromIso = `${data.from}T00:00:00Z`;
    const toIso = `${data.to}T23:59:59.999Z`;

    let itemsQuery = context.supabase
      .from("treatment_items")
      .select("professional_id, price_cents, completed_at, status")
      .eq("clinic_id", data.clinicId)
      .eq("status", "completed")
      .gte("completed_at", fromIso)
      .lte("completed_at", toIso);
    let prosQuery = context.supabase
      .from("professionals")
      .select("id, full_name")
      .eq("clinic_id", data.clinicId);
    if (data.professionalId) {
      itemsQuery = itemsQuery.eq("professional_id", data.professionalId);
      prosQuery = prosQuery.eq("id", data.professionalId);
    }

    const [
      { data: items, error: itemsErr },
      { data: pros, error: prosErr },
      { data: rules, error: rulesErr },
      settlementsRes,
    ] = await Promise.all([
      itemsQuery,
      prosQuery,
      context.supabase
        .from("commission_rules")
        .select("professional_id, kind, percent_bps, fixed_cents")
        .eq("clinic_id", data.clinicId),
      context.supabase
        .from("commission_settlements")
        .select(
          "id, professional_id, rule_kind, rule_percent_bps, rule_fixed_cents, production_cents, procedure_count, commission_cents, paid_at",
        )
        .eq("clinic_id", data.clinicId)
        .eq("period_from", data.from)
        .eq("period_to", data.to),
    ]);
    if (itemsErr) throw new Error(itemsErr.message);
    if (prosErr) throw new Error(prosErr.message);
    if (rulesErr) throw new Error(rulesErr.message);
    if (settlementsRes.error && !isUndefinedTableError(settlementsRes.error)) {
      throw new Error(settlementsRes.error.message);
    }
    const settlementByPro = new Map((settlementsRes.data ?? []).map((s) => [s.professional_id, s]));

    const ruleByPro = new Map(
      (rules ?? []).map((r) => [
        r.professional_id,
        { kind: r.kind as CommissionKind, percentBps: r.percent_bps, fixedCents: r.fixed_cents },
      ]),
    );

    type Acc = { production: number; count: number };
    const accByPro = new Map<string, Acc>();
    for (const it of items ?? []) {
      if (!it.professional_id) continue;
      const acc = accByPro.get(it.professional_id) ?? { production: 0, count: 0 };
      acc.production += it.price_cents ?? 0;
      acc.count += 1;
      accByPro.set(it.professional_id, acc);
    }

    const lines: CommissionLine[] = (pros ?? []).map((pro) => {
      const settlement = settlementByPro.get(pro.id);
      if (settlement) {
        // Período cerrado: el monto es el snapshot congelado, no se recalcula.
        const ruleLabel =
          settlement.rule_kind === "percent"
            ? `${(settlement.rule_percent_bps / 100).toFixed(2)}% sobre producción (cerrado)`
            : "Fijo por procedimiento (cerrado)";
        return {
          professionalId: pro.id,
          professionalName: pro.full_name,
          kind: settlement.rule_kind as CommissionKind,
          productionCents: settlement.production_cents,
          procedureCount: settlement.procedure_count,
          commissionCents: settlement.commission_cents,
          ruleLabel,
          closed: true,
          paidAt: settlement.paid_at,
          settlementId: settlement.id,
        };
      }

      const acc = accByPro.get(pro.id) ?? { production: 0, count: 0 };
      const rule = ruleByPro.get(pro.id) ?? null;
      let commission: number | null = null;
      let ruleLabel = "Sin regla configurada";
      if (rule) {
        if (rule.kind === "percent") {
          commission = Math.round((acc.production * rule.percentBps) / 10000);
          ruleLabel = `${(rule.percentBps / 100).toFixed(2)}% sobre producción`;
        } else {
          commission = rule.fixedCents * acc.count;
          ruleLabel = `Fijo por procedimiento`;
        }
      }
      return {
        professionalId: pro.id,
        professionalName: pro.full_name,
        kind: rule?.kind ?? null,
        productionCents: acc.production,
        procedureCount: acc.count,
        commissionCents: commission,
        ruleLabel,
        closed: false,
        paidAt: null,
        settlementId: null,
      };
    });

    // Ordena por comisión desc (los que más generan arriba); sin regla al final.
    return lines.sort(
      (a, b) =>
        (b.commissionCents ?? -1) - (a.commissionCents ?? -1) ||
        b.productionCents - a.productionCents,
    );
  });

/**
 * Cierra el período [from,to] para todos los profesionales con producción o
 * regla configurada: congela un snapshot en `commission_settlements` con la
 * regla y los montos vigentes AHORA. Solo owner/admin (RLS ya lo exige).
 * Si ya existe un cierre para ese rango+profesional, no lo duplica (UNIQUE
 * constraint) — devuelve error claro en vez del error crudo de Postgres.
 */
export const closeCommissionPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ closed: number }> => {
    const lines = await getCommissionReport({
      data: { clinicId: data.clinicId, from: data.from, to: data.to },
    });
    const toClose = lines.filter((l) => !l.closed && l.kind !== null);
    if (toClose.length === 0) return { closed: 0 };

    const rows = toClose.map((l) => ({
      clinic_id: data.clinicId,
      professional_id: l.professionalId,
      period_from: data.from,
      period_to: data.to,
      rule_kind: l.kind!,
      rule_percent_bps:
        l.kind === "percent"
          ? Math.round(((l.commissionCents ?? 0) * 10000) / (l.productionCents || 1))
          : 0,
      rule_fixed_cents:
        l.kind === "fixed" && l.procedureCount > 0
          ? Math.round((l.commissionCents ?? 0) / l.procedureCount)
          : 0,
      production_cents: l.productionCents,
      procedure_count: l.procedureCount,
      commission_cents: l.commissionCents ?? 0,
      closed_by: context.userId,
    }));

    const { error } = await context.supabase.from("commission_settlements").insert(rows);
    if (error) {
      if (error.code === "23505") {
        throw new Error("Este período ya fue cerrado para uno o más profesionales.");
      }
      throw new Error(error.message);
    }
    return { closed: rows.length };
  });

/** Marca un cierre existente como pagado. Solo owner/admin (RLS). */
export const markCommissionSettlementPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ clinicId: z.string().uuid(), settlementId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("commission_settlements")
      .update({ paid_at: new Date().toISOString(), paid_by: context.userId })
      .eq("id", data.settlementId)
      .eq("clinic_id", data.clinicId);
    if (error) throw new Error("No tienes permisos para marcar esta liquidación como pagada.");
    return { ok: true };
  });
