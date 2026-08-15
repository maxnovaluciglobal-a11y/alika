import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CLINIC_ROLES,
  isClinicRole,
  type ClinicAccess,
  type ClinicMember,
  type ClinicRole,
} from "@/lib/access";

/** Sesión + clínica activa + rol del usuario autenticado. */
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClinicAccess> => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: memberships, error }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("clinic_members")
        .select("role, clinics(id, name, onboarding_completed, timezone, is_demo)")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
    ]);

    if (error) throw new Error(error.message);

    const membership = (memberships ?? []).find((m) => m.clinics) ?? null;
    const role =
      membership && isClinicRole(membership.role) ? (membership.role as ClinicRole) : null;

    return {
      userId,
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      clinic: membership?.clinics
        ? {
            id: membership.clinics.id,
            name: membership.clinics.name,
            onboardingCompleted: membership.clinics.onboarding_completed,
            timezone: membership.clinics.timezone || "America/Santiago",
            isDemo: membership.clinics.is_demo ?? false,
          }
        : null,
      role,
    };
  });

/** Integrantes de una clínica. RLS solo devuelve filas de clínicas donde el usuario es miembro. */
export const listClinicMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ClinicMember[]> => {
    const { data: rows, error } = await context.supabase
      .from("clinic_members")
      .select("id, user_id, role")
      .eq("clinic_id", data.clinicId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    const userIds = (rows ?? []).map((row) => row.user_id);
    const { data: profiles } = userIds.length
      ? await context.supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", userIds)
      : { data: [] };

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    return (rows ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      role: (isClinicRole(row.role) ? row.role : "assistant") as ClinicRole,
      fullName: profileById.get(row.user_id)?.full_name ?? null,
      email: profileById.get(row.user_id)?.email ?? null,
      avatarUrl: profileById.get(row.user_id)?.avatar_url ?? null,
    }));
  });

/**
 * Cambia el rol de un integrante. La autorización real vive en RLS
 * (`members_update_managers`), esto añade la validación de negocio.
 */
export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        memberId: z.string().uuid(),
        role: z.enum(CLINIC_ROLES),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: member, error: readError } = await supabase
      .from("clinic_members")
      .select("id, user_id, clinic_id, role")
      .eq("id", data.memberId)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    if (!member) throw new Error("No encontramos a ese integrante.");
    if (member.user_id === userId) throw new Error("No puedes cambiar tu propio rol.");
    if (member.role === "owner")
      throw new Error("El rol de propietario no se puede modificar aquí.");
    if (data.role === "owner") throw new Error("Solo puede existir un propietario por clínica.");

    const { error } = await supabase
      .from("clinic_members")
      .update({ role: data.role })
      .eq("id", data.memberId);

    if (error) throw new Error("No tienes permisos para cambiar roles en esta clínica.");
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ memberId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: member, error: readError } = await supabase
      .from("clinic_members")
      .select("id, user_id, role")
      .eq("id", data.memberId)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    if (!member) throw new Error("No encontramos a ese integrante.");
    if (member.user_id === userId) throw new Error("No puedes quitarte a ti mismo del equipo.");
    if (member.role === "owner")
      throw new Error("No se puede quitar al propietario de la clínica.");

    const { error } = await supabase.from("clinic_members").delete().eq("id", data.memberId);
    if (error) throw new Error("No tienes permisos para quitar integrantes.");
    return { ok: true };
  });
