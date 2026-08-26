import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MedicalHistory = {
  allergies: string[];
  chronicMedications: string[];
  conditions: string[];
  notes: string | null;
  updatedAt: string | null;
};

const EMPTY_HISTORY: MedicalHistory = {
  allergies: [],
  chronicMedications: [],
  conditions: [],
  notes: null,
  updatedAt: null,
};

/** Antecedentes médicos del paciente — 1 fila, no versionada (a diferencia
 * de clinical_notes/odontogram_marks). Ausencia de fila = sin antecedentes
 * cargados todavía, no "sin alergias confirmadas" (regla #11: no fabricar
 * un negativo que nadie confirmó). */
export const getMedicalHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ clinicId: z.string().uuid(), patientId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<MedicalHistory> => {
    const { data: row, error } = await context.supabase
      .from("patient_medical_history")
      .select("allergies, chronic_medications, conditions, notes, updated_at")
      .eq("clinic_id", data.clinicId)
      .eq("patient_id", data.patientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return EMPTY_HISTORY;
    return {
      allergies: row.allergies ?? [],
      chronicMedications: row.chronic_medications ?? [],
      conditions: row.conditions ?? [],
      notes: row.notes,
      updatedAt: row.updated_at,
    };
  });

const listField = z.array(z.string().trim().min(1).max(80)).max(30);

/** Upsert por patient_id (UNIQUE) — perfil editable, no un historial de
 * eventos: no tiene sentido guardar "versión anterior" de una alergia. */
export const setMedicalHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        patientId: z.string().uuid(),
        allergies: listField,
        chronicMedications: listField,
        conditions: listField,
        notes: z.string().trim().max(2000).optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("patient_medical_history").upsert(
      {
        clinic_id: data.clinicId,
        patient_id: data.patientId,
        allergies: data.allergies,
        chronic_medications: data.chronicMedications,
        conditions: data.conditions,
        notes: data.notes?.trim() || null,
        updated_by: context.userId,
      },
      { onConflict: "patient_id" },
    );
    if (error) throw new Error("No tienes permisos para editar los antecedentes médicos.");
    return { ok: true };
  });
