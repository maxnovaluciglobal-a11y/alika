import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Mail, MailX } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { toast } from "sonner";
import {
  getMyNotificationPreferences,
  updateMyNotificationPreferences,
} from "@/lib/notification-preferences.functions";
import {
  DEFAULT_PREFERENCES,
  EMAIL_EVENTS,
  type EmailEventKey,
  type NotificationPreferences,
} from "@/lib/notification-preferences";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_clinic/preferencias")({
  head: () => ({
    meta: [
      { title: "Preferencias de aviso | Alika" },
      {
        name: "description",
        content:
          "Elige qué avisos por email quieres recibir de Alika y desuscríbete cuando lo necesites.",
      },
      { property: "og:title", content: "Preferencias de aviso | Alika" },
      {
        property: "og:description",
        content: "Control por tipo de evento de los emails y avisos de Alika.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PreferenciasPage,
});

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border border-border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        checked ? "bg-primary" : "bg-muted",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4.5 rounded-full bg-background shadow transition-all",
          checked ? "left-[1.4rem]" : "left-0.5",
        )}
      />
    </button>
  );
}

function PreferenciasPage() {
  const { access } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const cargar = useServerFn(getMyNotificationPreferences);
  const guardar = useServerFn(updateMyNotificationPreferences);

  const { data, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => cargar({}),
  });

  const prefs: NotificationPreferences = data ?? DEFAULT_PREFERENCES;
  const desuscrito = Boolean(prefs.unsubscribedAt);

  const mutation = useMutation({
    mutationFn: (input: {
      emailEnabled?: boolean;
      inappEnabled?: boolean;
      unsubscribed?: boolean;
      events?: Record<string, boolean>;
    }) => guardar({ data: input }),

    onSuccess: (nuevo) => {
      queryClient.setQueryData(["notification-preferences"], nuevo);
      toast.success("Preferencias guardadas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bloqueado = isLoading || mutation.isPending;
  const emailsActivos = prefs.emailEnabled && !desuscrito;

  return (
    <AppShell title="Preferencias de aviso" access={access}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <Mail className="mt-0.5 size-5 text-primary" />
              <div>
                <h2 className="font-heading text-base font-semibold">Avisos por email</h2>
                <p className="text-sm text-muted-foreground">
                  Recibe en tu correo los eventos del flujo de revisión clínica.
                </p>
              </div>
            </div>
            <Switch
              label="Activar avisos por email"
              checked={emailsActivos}
              disabled={bloqueado || desuscrito}
              onChange={(v) => mutation.mutate({ emailEnabled: v })}
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <BellRing className="mt-0.5 size-5 text-primary" />
              <div>
                <h2 className="font-heading text-base font-semibold">Avisos dentro de Alika</h2>
                <p className="text-sm text-muted-foreground">
                  Campana de notificaciones en tiempo real dentro de la aplicación.
                </p>
              </div>
            </div>
            <Switch
              label="Activar avisos en la aplicación"
              checked={prefs.inappEnabled}
              disabled={bloqueado}
              onChange={(v) => mutation.mutate({ inappEnabled: v })}
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <header className="border-b border-border p-5">
            <h2 className="font-heading text-base font-semibold">Emails por tipo de evento</h2>
            <p className="text-sm text-muted-foreground">
              Ajusta cada aviso por separado. Si desactivas los emails generales, ninguno se envía.
            </p>
          </header>
          <ul className="divide-y divide-border">
            {EMAIL_EVENTS.map((evento) => (
              <li key={evento.key} className="flex items-start justify-between gap-4 p-5">
                <div>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      !emailsActivos && "text-muted-foreground",
                    )}
                  >
                    {evento.label}
                  </p>
                  <p className="text-sm text-muted-foreground">{evento.description}</p>
                </div>
                <Switch
                  label={`Email de ${evento.label}`}
                  checked={prefs.events[evento.key as EmailEventKey]}
                  disabled={bloqueado || !emailsActivos}
                  onChange={(v) => mutation.mutate({ events: { [evento.key]: v } })}
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex gap-3">
            <MailX className="mt-0.5 size-5 text-destructive" />
            <div className="flex-1">
              <h2 className="font-heading text-base font-semibold">Desuscripción total</h2>
              <p className="text-sm text-muted-foreground">
                {desuscrito
                  ? "Estás desuscrito: Alika no te enviará ningún email de avisos. Los avisos clínicos seguirán visibles dentro de la aplicación."
                  : "Detiene todos los emails de avisos de Alika de una sola vez. Puedes revertirlo cuando quieras."}
              </p>
              <button
                type="button"
                disabled={bloqueado}
                onClick={() => mutation.mutate({ unsubscribed: !desuscrito })}
                className={cn(
                  "mt-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50",
                  desuscrito
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "border border-destructive/40 text-destructive hover:bg-destructive/10",
                )}
              >
                {desuscrito ? "Volver a suscribirme" : "Desuscribirme de todos los emails"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
