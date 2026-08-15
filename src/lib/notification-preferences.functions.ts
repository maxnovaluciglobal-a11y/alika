import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_PREFERENCES,
  EMAIL_EVENTS,
  type NotificationPreferences,
} from "@/lib/notification-preferences";

const eventKeys = EMAIL_EVENTS.map((e) => e.key);

function mapRow(row: Record<string, unknown> | null): NotificationPreferences {
  if (!row) return DEFAULT_PREFERENCES;
  const events = { ...DEFAULT_PREFERENCES.events };
  for (const key of eventKeys) {
    events[key] = Boolean(row[key]);
  }
  return {
    emailEnabled: Boolean(row.email_enabled),
    inappEnabled: Boolean(row.inapp_enabled),
    unsubscribedAt: (row.unsubscribed_at as string | null) ?? null,
    events,
  };
}

/** Devuelve las preferencias de notificación del usuario autenticado. */
export const getMyNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationPreferences> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error("No pudimos cargar tus preferencias de aviso.");
    return mapRow(data as Record<string, unknown> | null);
  });

const updateSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inappEnabled: z.boolean().optional(),
  unsubscribed: z.boolean().optional(),
  events: z.record(z.enum(eventKeys as [string, ...string[]]), z.boolean()).optional(),
});

/** Guarda las preferencias de notificación del usuario autenticado. */
export const updateMyNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }): Promise<NotificationPreferences> => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    const actual = mapRow(existing as Record<string, unknown> | null);

    const unsubscribed =
      data.unsubscribed === undefined ? Boolean(actual.unsubscribedAt) : data.unsubscribed;

    const payload: Record<string, unknown> = {
      user_id: userId,
      email_enabled: data.emailEnabled ?? actual.emailEnabled,
      inapp_enabled: data.inappEnabled ?? actual.inappEnabled,
      unsubscribed_at: unsubscribed ? (actual.unsubscribedAt ?? new Date().toISOString()) : null,
    };
    for (const key of eventKeys) {
      payload[key] = data.events?.[key] ?? actual.events[key];
    }

    const { data: saved, error } = await supabase
      .from("notification_preferences")
      .upsert(payload as never, { onConflict: "user_id" })

      .select("*")
      .single();
    if (error) throw new Error("No pudimos guardar tus preferencias de aviso.");
    return mapRow(saved as Record<string, unknown>);
  });
