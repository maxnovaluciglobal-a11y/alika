import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, CheckCircle2, Clock, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { formatoFechaLarga, hoyISO } from "@/lib/clinic-data";
import { formatMoney } from "@/lib/finance";
import { getMyPortalOverview, requestPortalAppointment } from "@/lib/portal.functions";

export const Route = createFileRoute("/portal/inicio")({
  head: () => ({
    meta: [{ title: "Mi clínica · Portal Alika" }, { name: "robots", content: "noindex" }],
  }),
  component: PortalInicio,
});

function PortalInicio() {
  const fetchOverview = useServerFn(getMyPortalOverview);
  const requestFn = useServerFn(requestPortalAppointment);
  const queryClient = useQueryClient();

  const overview = useQuery({
    queryKey: ["portal-overview"],
    queryFn: () => fetchOverview({}),
    retry: false,
  });

  const [preferredDate, setPreferredDate] = useState(hoyISO());
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<"baja" | "media" | "alta">("media");
  const [enviado, setEnviado] = useState(false);

  const requestMut = useMutation({
    mutationFn: () => requestFn({ data: { preferredDate, reason, priority } }),
    onSuccess: () => {
      setEnviado(true);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["portal-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (overview.isError) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Tu enlace del portal venció o no es válido. Contacta a tu clínica para que te envíe uno
          nuevo.
        </p>
      </div>
    );
  }

  if (overview.isLoading || !overview.data) {
    return (
      <div className="mx-auto flex max-w-md items-center justify-center p-6">
        <Loader2 className="size-5 animate-spin text-brand" />
      </div>
    );
  }

  const { patient, appointments, plans } = overview.data;

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <section>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Hola, {patient.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Este es tu portal. Puedes ver tus próximas citas y pedir hora.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Próximas citas</h2>
        {appointments.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
            No tienes citas agendadas.
          </p>
        )}
        {appointments.map((a) => (
          <article key={a.id} className="rounded-xl border border-border/60 bg-card p-4">
            <p className="truncate text-sm font-semibold">{a.treatment_label ?? "Consulta"}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5 shrink-0" /> {formatoFechaLarga(a.starts_at.slice(0, 10))}
            </p>
          </article>
        ))}
      </section>

      {plans.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Tus tratamientos</h2>
          {plans.map((p) => (
            <article key={p.id} className="rounded-xl border border-border/60 bg-card p-4">
              <p className="truncate text-sm font-semibold">{p.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatMoney(p.total_cents, p.currency)}
              </p>
            </article>
          ))}
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-brand" />
          <h2 className="text-sm font-semibold">Pedir una hora</h2>
        </div>
        {enviado ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="size-8 text-brand" />
            <p className="text-sm font-medium">Solicitud enviada</p>
            <p className="text-xs text-muted-foreground">
              La clínica te va a contactar para confirmarte la hora.
            </p>
            <button
              type="button"
              onClick={() => setEnviado(false)}
              className="mt-2 text-xs text-brand underline"
            >
              Pedir otra
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Día preferido</label>
              <input
                type="date"
                value={preferredDate}
                min={hoyISO()}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="w-full rounded-lg border border-border/60 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Motivo</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Por ejemplo: dolor en la muela superior derecha…"
                rows={3}
                maxLength={500}
                className="w-full rounded-lg border border-border/60 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Urgencia</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className="w-full rounded-lg border border-border/60 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              >
                <option value="baja">Baja — puedo esperar</option>
                <option value="media">Media — esta semana</option>
                <option value="alta">Alta — dolor / urgencia</option>
              </select>
            </div>
            <button
              type="button"
              disabled={!reason.trim() || requestMut.isPending}
              onClick={() => requestMut.mutate()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-medium text-brand-foreground disabled:opacity-50"
            >
              {requestMut.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Enviar solicitud
            </button>
          </>
        )}
      </section>
    </div>
  );
}
