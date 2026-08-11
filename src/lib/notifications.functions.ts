import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppNotification } from "@/lib/notifications";

/** Lista las notificaciones del usuario autenticado, más recientes primero. */
export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppNotification[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notifications")
      .select("id, kind, title, body, link, note_id, patient_ref, read_at, created_at")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error("No pudimos cargar tus notificaciones.");
    return (data ?? []).map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      link: n.link,
      noteId: n.note_id,
      patientRef: n.patient_ref,
      readAt: n.read_at,
      createdAt: n.created_at,
    }));
  });

/** Marca una notificación (o todas) como leídas. */
export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ notificationId: z.string().uuid().nullable().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let query = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", userId)
      .is("read_at", null);
    if (data.notificationId) query = query.eq("id", data.notificationId);
    const { error } = await query;
    if (error) throw new Error("No pudimos actualizar tus notificaciones.");
    return { ok: true };
  });
