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
};

/**
 * Liquidación de comisiones por profesional en un rango [from, to] (fechas
 * civiles YYYY-MM-DD, inclusive). Se basa en treatment_items completados con
 * completed_at dentro del rango. La comisión se calcula con la regla vigente
 * de cada profesional al momento de correr el reporte.
 */
export const getCommissionReport = createServerFn({ method: "GET" })
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
  .handler(async ({ data, context }): Promise<CommissionLine[]> => {
    // completed_at es timestamptz; el rango civil [from 00:00, to 24:00).
    const fromIso = `${data.from}T00:00:00Z`;
    const toIso = `${data.to}T23:59:59.999Z`;

    const [
      { data: items, error: itemsErr },
      { data: pros, error: prosErr },
      { data: rules, error: rulesErr },
    ] = await Promise.all([
      context.supabase
        .from("treatment_items")
        .select("professional_id, price_cents, completed_at, status")
        .eq("clinic_id", data.clinicId)
        .eq("status", "completed")
        .gte("completed_at", fromIso)
        .lte("completed_at", toIso),
      context.supabase.from("professionals").select("id, full_name").eq("clinic_id", data.clinicId),
      context.supabase
        .from("commission_rules")
        .select("professional_id, kind, percent_bps, fixed_cents")
        .eq("clinic_id", data.clinicId),
    ]);
    if (itemsErr) throw new Error(itemsErr.message);
    if (prosErr) throw new Error(prosErr.message);
    if (rulesErr) throw new Error(rulesErr.message);

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
      };
    });

    // Ordena por comisión desc (los que más generan arriba); sin regla al final.
    return lines.sort(
      (a, b) =>
        (b.commissionCents ?? -1) - (a.commissionCents ?? -1) ||
        b.productionCents - a.productionCents,
    );
  });
