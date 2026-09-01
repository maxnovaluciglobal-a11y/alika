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
import { mensajeDb } from "@/lib/db-errors";

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
        .select(
          "role, clinics(id, name, onboarding_completed, timezone, country, is_demo, currency)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
    ]);

    if (error) throw new Error(mensajeDb(error, "No pudimos cargar tu acceso a la clínica."));

    const membership = (memberships ?? []).find((m) => m.clinics) ?? null;
    const role =
      membership && isClinicRole(membership.role) ? (membership.role as ClinicRole) : null;

    // ux-3: si el usuario tiene ficha de profesional en la clínica activa
    // (ej. es dentist), resolvemos su professional_id acá una sola vez —
    // así /comisiones (y cualquier otra pantalla "ver lo mío") no tiene que
    // hacer esta query por su cuenta.
    let myProfessionalId: string | null = null;
    if (membership?.clinics) {
      const { data: myPro } = await supabase
        .from("professionals")
        .select("id")
        .eq("clinic_id", membership.clinics.id)
        .eq("user_id", userId)
        .maybeSingle();
      myProfessionalId = myPro?.id ?? null;
    }

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
            country: membership.clinics.country || "CL",
            isDemo: membership.clinics.is_demo ?? false,
            currency: membership.clinics.currency || "CLP",
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

    if (error) throw new Error(mensajeDb(error, "No pudimos cargar el equipo de la clínica."));

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

    if (readError)
      throw new Error(
        mensajeDb(readError, "No pudimos cargar los datos de ese integrante para cambiar su rol."),
      );
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

/**
 * Invita a una persona nueva al equipo de la clínica: crea (o reutiliza)
 * el usuario en Supabase Auth vía Admin API y lo agrega a `clinic_members`.
 *
 * Autorización en dos capas, igual que el resto del módulo:
 * 1. Chequeo explícito acá (misma condición que `can_manage_clinic`:
 *    el caller debe ser owner/admin de la clínica) — no depender solo de RLS
 *    porque el insert real lo hace `supabaseAdmin` con service_role, que
 *    bypassea RLS por diseño.
 * 2. La policy `members_insert_managers` sigue protegiendo cualquier otro
 *    camino de escritura contra esta tabla que no pase por acá.
 */
export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        email: z.string().trim().toLowerCase().email("Email inválido."),
        fullName: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
        role: z.enum(CLINIC_ROLES),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.role === "owner") {
      throw new Error("Solo puede existir un propietario por clínica.");
    }

    // Defensa en profundidad: mismo criterio que can_manage_clinic(clinic_id)
    // (helper SQL), verificado acá porque el insert de más abajo lo hace el
    // cliente admin (service_role), que no pasa por RLS.
    const { data: membership, error: membershipError } = await supabase
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError)
      throw new Error(
        mensajeDb(membershipError, "No pudimos verificar tus permisos para invitar integrantes."),
      );
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throw new Error("No tienes permisos para invitar integrantes en esta clínica.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // ¿La clínica ya tiene un miembro con ese email? Evita duplicar el alta.
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();

    if (existingProfile) {
      const { data: existingMember } = await supabaseAdmin
        .from("clinic_members")
        .select("id")
        .eq("clinic_id", data.clinicId)
        .eq("user_id", existingProfile.id)
        .maybeSingle();
      if (existingMember) {
        throw new Error("Esa persona ya es parte del equipo de esta clínica.");
      }
    }

    let newUserId = existingProfile?.id ?? null;

    if (!newUserId) {
      const { data: invited, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
          data: { full_name: data.fullName },
        });

      if (inviteError || !invited?.user) {
        // Ya existe en auth.users pero sin profile (caso raro) — no reintentamos
        // login/lookup manual acá, es más seguro pedirle a Walter que lo revise.
        throw new Error(
          inviteError?.message?.includes("already been registered")
            ? "Ya existe una cuenta con ese email. Contacta a soporte para agregarla a esta clínica."
            : "No se pudo invitar a esa persona. Intenta de nuevo.",
        );
      }
      newUserId = invited.user.id;
    }

    const { error: memberError } = await supabaseAdmin.from("clinic_members").insert({
      clinic_id: data.clinicId,
      user_id: newUserId,
      role: data.role,
    });

    if (memberError) {
      if (memberError.code === "23505") {
        throw new Error("Esa persona ya es parte del equipo de esta clínica.");
      }
      throw new Error("No se pudo agregar a esa persona al equipo.");
    }

    return { ok: true, invited: !existingProfile };
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

    if (readError)
      throw new Error(
        mensajeDb(
          readError,
          "No pudimos cargar los datos de ese integrante para quitarlo del equipo.",
        ),
      );
    if (!member) throw new Error("No encontramos a ese integrante.");
    if (member.user_id === userId) throw new Error("No puedes quitarte a ti mismo del equipo.");
    if (member.role === "owner")
      throw new Error("No se puede quitar al propietario de la clínica.");

    const { error } = await supabase.from("clinic_members").delete().eq("id", data.memberId);
    if (error) throw new Error("No tienes permisos para quitar integrantes.");
    return { ok: true };
  });
