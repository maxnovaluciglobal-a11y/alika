import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyNotifications,
  markNotificationsRead,
} from "@/lib/notifications.functions";
import { NOTIFICATION_KIND_LABELS, tiempoRelativo } from "@/lib/notifications";

/** Campana de notificaciones internas con actualización en tiempo real. */
export function NotificationsBell({ userId }: { userId?: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const queryClient = useQueryClient();
  const queryKey = ["notifications", userId ?? "anon"];

  const { data: notificaciones = [], isLoading } = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: () => listMyNotifications(),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => queryClient.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const marcar = useMutation({
    mutationFn: (notificationId: string | null) =>
      markNotificationsRead({ data: { notificationId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (!userId) return null;
  const sinLeer = notificaciones.filter((n) => !n.readAt).length;

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-label="Notificaciones"
        className="relative inline-flex size-9 items-center justify-center rounded-lg border border-hairline hover:bg-secondary/60"
      >
        <Bell className="size-4" />
        {sinLeer > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-brand px-1 text-[10px] font-semibold leading-4 text-brand-foreground">
            {sinLeer > 9 ? "9+" : sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-hairline bg-background p-2 shadow-lg">
            <div className="flex items-center justify-between px-2 py-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notificaciones
              </p>
              {sinLeer > 0 && (
                <button
                  onClick={() => marcar.mutate(null)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {marcar.isPending ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3" />
                  )}
                  Marcar todas
                </button>
              )}
            </div>

            <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
              {isLoading && <p className="px-2 py-3 text-xs text-muted-foreground">Cargando…</p>}
              {!isLoading && notificaciones.length === 0 && (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  No tienes notificaciones por ahora.
                </p>
              )}
              {notificaciones.map((n) => {
                const contenido = (
                  <>
                    <p className="text-xs font-medium">{n.title}</p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {NOTIFICATION_KIND_LABELS[n.kind] ?? "Aviso"} · {tiempoRelativo(n.createdAt)}
                    </p>
                  </>
                );
                const clases = `block rounded-lg border p-2.5 text-left ${
                  n.readAt ? "border-hairline" : "border-brand/30 bg-brand/5"
                }`;
                return n.patientRef ? (
                  <Link
                    key={n.id}
                    to="/pacientes/$pacienteId"
                    params={{ pacienteId: n.patientRef }}
                    onClick={() => {
                      setAbierto(false);
                      if (!n.readAt) marcar.mutate(n.id);
                    }}
                    className={clases}
                  >
                    {contenido}
                  </Link>
                ) : (
                  <button
                    key={n.id}
                    onClick={() => !n.readAt && marcar.mutate(n.id)}
                    className={`w-full ${clases}`}
                  >
                    {contenido}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
