import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  TOOTH_CONDITIONS,
  TOOTH_SURFACES,
  WHOLE_TOOTH_CONDITIONS,
  type OdontogramMark,
} from "@/lib/odontogram";

const TOOTH_SURFACE_ENUM = z.enum(TOOTH_SURFACES);
const TOOTH_CONDITION_ENUM = z.enum(TOOTH_CONDITIONS);
const TOOTH_NUMBER = z
  .number()
  .int()
  .refine(
    (n) =>
      (n >= 11 && n <= 18) ||
      (n >= 21 && n <= 28) ||
      (n >= 31 && n <= 38) ||
      (n >= 41 && n <= 48) ||
      (n >= 51 && n <= 55) ||
      (n >= 61 && n <= 65) ||
      (n >= 71 && n <= 75) ||
      (n >= 81 && n <= 85),
    "Número de pieza FDI inválido (usar cuadrantes 1-8 con dientes 1-8, permanentes o deciduos).",
  );

type MarkRow = {
  id: string;
  tooth_number: number;
  surface: string;
  condition: string;
  material: string | null;
  notes: string | null;
  superseded_at: string | null;
  recorded_at: string;
  recorded_by: string;
};

function mapRow(row: MarkRow, nameByUser: Map<string, string | null>): OdontogramMark {
  return {
    id: row.id,
    toothNumber: row.tooth_number,
    surface: row.surface as OdontogramMark["surface"],
    condition: row.condition as OdontogramMark["condition"],
    material: row.material,
    notes: row.notes,
    supersededAt: row.superseded_at,
    recordedAt: row.recorded_at,
    recordedById: row.recorded_by,
    recordedByName: nameByUser.get(row.recorded_by) ?? null,
  };
}

const MARK_COLUMNS =
  "id, tooth_number, surface, condition, material, notes, superseded_at, recorded_at, recorded_by";

/** Marcas vigentes del odontograma del paciente. */
export const listOdontogramMarks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ clinicId: z.string().uuid(), patientId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<OdontogramMark[]> => {
    const { supabase } = context;

    const { data: rows, error } = await supabase
      .from("odontogram_marks")
      .select(MARK_COLUMNS)
      .eq("clinic_id", data.clinicId)
      .eq("patient_id", data.patientId)
      .is("superseded_at", null)
      .order("tooth_number", { ascending: true })
      .order("surface", { ascending: true });

    if (error) throw new Error(error.message);

    const marks = (rows ?? []) as MarkRow[];
    const userIds = [...new Set(marks.map((m) => m.recorded_by))];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] };
    const nameByUser = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    return marks.map((row) => mapRow(row, nameByUser));
  });

/** Historia completa (incluye marcas cerradas) para una pieza específica o todo el paciente. */
export const listOdontogramHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        patientId: z.string().uuid(),
        toothNumber: TOOTH_NUMBER.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<OdontogramMark[]> => {
    const { supabase } = context;

    let query = supabase
      .from("odontogram_marks")
      .select(MARK_COLUMNS)
      .eq("clinic_id", data.clinicId)
      .eq("patient_id", data.patientId)
      .order("recorded_at", { ascending: false })
      .limit(500);

    if (data.toothNumber !== undefined) {
      query = query.eq("tooth_number", data.toothNumber);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const marks = (rows ?? []) as MarkRow[];
    const userIds = [...new Set(marks.map((m) => m.recorded_by))];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] };
    const nameByUser = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    return marks.map((row) => mapRow(row, nameByUser));
  });

/**
 * Registra una marca nueva. El trigger de la base cierra automáticamente la
 * marca vigente anterior para la misma (paciente, pieza, superficie) — nunca
 * se hace UPDATE de una marca ya guardada.
 */
export const setOdontogramMark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        patientId: z.string().uuid(),
        toothNumber: TOOTH_NUMBER,
        surface: TOOTH_SURFACE_ENUM,
        condition: TOOTH_CONDITION_ENUM,
        material: z.string().trim().max(120).optional(),
        notes: z.string().trim().max(500).optional(),
      })
      .refine((v) => v.surface === "whole" || !WHOLE_TOOTH_CONDITIONS.includes(v.condition), {
        message:
          "Ausente, implante, corona y prótesis solo pueden marcarse a nivel de pieza completa.",
        path: ["condition"],
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase } = context;

    const { data: inserted, error } = await supabase
      .from("odontogram_marks")
      .insert({
        clinic_id: data.clinicId,
        patient_id: data.patientId,
        tooth_number: data.toothNumber,
        surface: data.surface,
        condition: data.condition,
        material: data.material || null,
        notes: data.notes || null,
      })
      .select("id")
      .single();

    if (error) throw new Error("No tienes permisos para modificar el odontograma.");
    return { id: inserted.id };
  });
