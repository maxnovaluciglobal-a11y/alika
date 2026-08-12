import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Profesional, Sucursal } from "@/lib/clinic-data";

/** Sucursales de la clínica. RLS: solo las de clínicas donde el usuario es miembro. */
export const listBranches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<Sucursal[]> => {
    const { data: rows, error } = await context.supabase
      .from("branches")
      .select("id, name, city")
      .eq("clinic_id", data.clinicId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => ({ id: r.id, nombre: r.name, ciudad: r.city ?? "Sin ciudad" }));
  });

/** Profesionales de la clínica, con especialidad y box por defecto resueltos. */
export const listProfessionals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<Profesional[]> => {
    const { supabase } = context;

    const { data: rows, error } = await supabase
      .from("professionals")
      .select("id, full_name, branch_id, specialty_id, default_operatory_id")
      .eq("clinic_id", data.clinicId)
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (error) throw new Error(error.message);

    const specialtyIds = [
      ...new Set((rows ?? []).map((r) => r.specialty_id).filter((v): v is string => Boolean(v))),
    ];
    const operatoryIds = [
      ...new Set(
        (rows ?? []).map((r) => r.default_operatory_id).filter((v): v is string => Boolean(v)),
      ),
    ];

    const [{ data: specialties, error: specError }, { data: operatories, error: opError }] =
      await Promise.all([
        supabase
          .from("specialties")
          .select("id, name")
          .in("id", specialtyIds.length ? specialtyIds : [""]),
        supabase
          .from("operatories")
          .select("id, name")
          .in("id", operatoryIds.length ? operatoryIds : [""]),
      ]);

    if (specError) throw new Error(specError.message);
    if (opError) throw new Error(opError.message);

    const specialtyById = new Map((specialties ?? []).map((s) => [s.id, s.name]));
    const operatoryById = new Map((operatories ?? []).map((o) => [o.id, o.name]));

    return (rows ?? []).map((r) => ({
      id: r.id,
      nombre: r.full_name,
      box:
        (r.default_operatory_id && operatoryById.get(r.default_operatory_id)) || "Sin box asignado",
      especialidad: (r.specialty_id && specialtyById.get(r.specialty_id)) || "Sin especialidad",
      sucursalId: r.branch_id ?? "",
    }));
  });
