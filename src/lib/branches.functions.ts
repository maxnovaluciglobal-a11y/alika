import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mensajeDb } from "@/lib/db-errors";

export type BranchDetail = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  opensAt: string;
  closesAt: string;
  isActive: boolean;
  operatories: { id: string; name: string }[];
};

const branchInputSchema = z.object({
  name: z.string().trim().min(2, "Nombre de la sucursal requerido").max(120),
  address: z.string().trim().max(180).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  opensAt: z.string().regex(/^\d{2}:\d{2}$/),
  closesAt: z.string().regex(/^\d{2}:\d{2}$/),
  operatories: z.array(z.string().trim().min(1).max(60)).min(1, "Agrega al menos un box"),
});

/** Sucursales con detalle completo (incluye boxes e inactivas) para la
 * pantalla de administración — a diferencia de listBranches en
 * clinic-catalog.functions.ts, que es liviana y solo trae activas. */
export const listBranchesDetailed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<BranchDetail[]> => {
    const { data: branches, error } = await context.supabase
      .from("branches")
      .select("id, name, address, city, phone, opens_at, closes_at, is_active")
      .eq("clinic_id", data.clinicId)
      .order("name", { ascending: true });
    if (error) throw new Error(mensajeDb(error, "No pudimos cargar las sucursales."));

    const branchIds = (branches ?? []).map((b) => b.id);
    const { data: operatories, error: opError } = await context.supabase
      .from("operatories")
      .select("id, name, branch_id")
      .in("branch_id", branchIds.length ? branchIds : [""])
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (opError)
      throw new Error(mensajeDb(opError, "No pudimos cargar los boxes de las sucursales."));

    const opsByBranch = new Map<string, { id: string; name: string }[]>();
    for (const op of operatories ?? []) {
      const list = opsByBranch.get(op.branch_id) ?? [];
      list.push({ id: op.id, name: op.name });
      opsByBranch.set(op.branch_id, list);
    }

    return (branches ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      city: b.city,
      phone: b.phone,
      opensAt: b.opens_at,
      closesAt: b.closes_at,
      isActive: b.is_active,
      operatories: opsByBranch.get(b.id) ?? [],
    }));
  });

/** Alta de sucursal fuera del onboarding inicial — misma forma que el paso
 * "Sucursal y boxes" del wizard, reusada acá para que una clínica que crece
 * pueda agregar una sede sin tocar la base de datos a mano. RLS
 * (branches_write / operatories_write) ya exige can_manage_clinic. */
export const createBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ clinicId: z.string().uuid(), branch: branchInputSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .select("timezone")
      .eq("id", data.clinicId)
      .single();
    if (clinicError || !clinic) throw new Error("No encontramos la clínica.");

    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .insert({
        clinic_id: data.clinicId,
        name: data.branch.name.trim(),
        address: data.branch.address?.trim() || null,
        city: data.branch.city?.trim() || null,
        phone: data.branch.phone?.trim() || null,
        timezone: clinic.timezone,
        opens_at: data.branch.opensAt,
        closes_at: data.branch.closesAt,
      })
      .select("id")
      .single();
    if (branchError || !branch)
      throw new Error(mensajeDb(branchError, "No se pudo crear la sucursal."));

    const { error: opError } = await supabase.from("operatories").insert(
      data.branch.operatories.map((name) => ({
        clinic_id: data.clinicId,
        branch_id: branch.id,
        name: name.trim(),
      })),
    );
    if (opError) throw new Error(mensajeDb(opError, "No pudimos crear los boxes de la sucursal."));

    return { branchId: branch.id };
  });

/** Edita datos básicos de una sucursal existente (no boxes — ver
 * addOperatory). isActive permite dar de baja una sucursal sin borrar su
 * historial de citas/pacientes asociados. */
export const updateBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        branchId: z.string().uuid(),
        name: z.string().trim().min(2).max(120),
        address: z.string().trim().max(180).optional().or(z.literal("")),
        city: z.string().trim().max(80).optional().or(z.literal("")),
        phone: z.string().trim().max(40).optional().or(z.literal("")),
        opensAt: z.string().regex(/^\d{2}:\d{2}$/),
        closesAt: z.string().regex(/^\d{2}:\d{2}$/),
        isActive: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("branches")
      .update({
        name: data.name.trim(),
        address: data.address?.trim() || null,
        city: data.city?.trim() || null,
        phone: data.phone?.trim() || null,
        opens_at: data.opensAt,
        closes_at: data.closesAt,
        is_active: data.isActive,
      })
      .eq("id", data.branchId)
      .eq("clinic_id", data.clinicId);
    if (error) throw new Error("No tienes permisos para editar esta sucursal.");
    return { ok: true };
  });

/** Agrega un box/operatorio a una sucursal existente. */
export const addOperatory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        branchId: z.string().uuid(),
        name: z.string().trim().min(1).max(60),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("operatories").insert({
      clinic_id: data.clinicId,
      branch_id: data.branchId,
      name: data.name.trim(),
    });
    if (error) throw new Error("No tienes permisos para agregar boxes en esta sucursal.");
    return { ok: true };
  });
