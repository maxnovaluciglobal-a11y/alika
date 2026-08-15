import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, MessageCircleMore } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { requirePermission } from "@/lib/route-guards";
import { listPendingReminders, type PendingReminder } from "@/lib/messaging.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_clinic/recordatorios")({
  beforeLoad: requirePermission("agenda:manage"),
  head: () => ({
    meta: [
      { title: "Recordatorios | Alika" },
      {
        name: "description",
        content:
          "Cola de recordatorios de 48h y avisos de 3h antes de cada cita, listos para mandar por WhatsApp con un click.",
      },
      { property: "og:title", content: "Recordatorios | Alika" },
      {
        property: "og:description",
        content: "Citas que necesitan recordatorio de 48h o aviso de 3h, sin buscarlas a mano.",
      },
    ],
  }),
  component: RecordatoriosPage,
});

function filaClass(kind: PendingReminder["reminderKind"]) {
  return kind === "appointment_checkin"
    ? "bg-warning-soft text-warning"
    : "bg-brand-soft text-brand";
}

function RecordatoriosPage() {
  const { access } = Route.useRouteContext();
  const clinicId = access.clinic?.id;
  const clinicaNombre = access.clinic?.name ?? "";
  const queryClient = useQueryClient();

  const fetchReminders = useServerFn(listPendingReminders);
  const { data: recordatorios = [], isLoading } = useQuery({
    queryKey: ["pending-reminders", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchReminders({ data: { clinicId: clinicId! } }),
    // Las ventanas de 48h/3h se mueven con el reloj — refrescar cada minuto
    // para que una cita no quede "vieja" en pantalla si nadie navega.
    refetchInterval: 60_000,
  });

  const { aviso3h, recordatorio48h } = useMemo(() => {
    const aviso3h = recordatorios.filter((r) => r.reminderKind === "appointment_checkin");
    const recordatorio48h = recordatorios.filter((r) => r.reminderKind === "appointment_reminder");
    return { aviso3h, recordatorio48h };
  }, [recordatorios]);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["pending-reminders", clinicId] });
  };

  return (
    <AppShell title="Recordatorios" access={access}>
      <div className="space-y-6">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Citas que están entrando a la ventana de 48h (recordatorio) o 3h (aviso previo) y todavía
          no tienen ese mensaje registrado. Se manda por WhatsApp con un click — sin costo, sin
          integración automática.
        </p>

        {isLoading && (
          <p className="px-1 py-10 text-center text-sm text-muted-foreground">Cargando…</p>
        )}

        {!isLoading && recordatorios.length === 0 && (
          <div className="card-clinical p-10 text-center">
            <MessageCircleMore className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No hay recordatorios pendientes ahora mismo.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Esta lista se arma sola a medida que las citas entran a la ventana de 48h o 3h.
            </p>
          </div>
        )}

        {!isLoading && aviso3h.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 font-display text-lg font-semibold">
              <Clock className="size-4 text-warning" /> Aviso de 3h
              <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">
                {aviso3h.length}
              </span>
            </h2>
            <ReminderList
              items={aviso3h}
              clinicId={clinicId!}
              clinica={clinicaNombre}
              onSent={invalidar}
            />
          </section>
        )}

        {!isLoading && recordatorio48h.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 font-display text-lg font-semibold">
              <Clock className="size-4 text-brand" /> Recordatorio de 48h
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
                {recordatorio48h.length}
              </span>
            </h2>
            <ReminderList
              items={recordatorio48h}
              clinicId={clinicId!}
              clinica={clinicaNombre}
              onSent={invalidar}
            />
          </section>
        )}
      </div>
    </AppShell>
  );
}

function ReminderList({
  items,
  clinicId,
  clinica,
  onSent,
}: {
  items: PendingReminder[];
  clinicId: string;
  clinica: string;
  onSent: () => void;
}) {
  return (
    <div className="card-clinical divide-y divide-hairline overflow-hidden">
      {items.map((r) => (
        <div
          key={r.appointmentId}
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium">{r.patientName}</p>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                  filaClass(r.reminderKind),
                )}
              >
                {r.reminderKind === "appointment_checkin" ? "3h" : "48h"}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {r.treatmentLabel} · {r.professionalName} · {r.fechaLarga} {r.hora}
            </p>
            {!r.patientPhone && (
              <p className="mt-1 text-[11px] text-destructive">
                Sin teléfono cargado — no se puede enviar.
              </p>
            )}
          </div>
          <WhatsAppButton
            clinicId={clinicId}
            patientId={r.patientId}
            appointmentId={r.appointmentId}
            templateKind={r.reminderKind}
            variant="full"
            label="Enviar"
            variables={{
              tratamiento: r.treatmentLabel,
              fecha_larga: r.fechaLarga,
              hora: r.hora,
              profesional: r.professionalName,
              clinica,
            }}
            onSent={onSent}
          />
        </div>
      ))}
    </div>
  );
}
