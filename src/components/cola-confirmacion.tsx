import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
import { setPatientConfirmation } from "@/lib/clinic-operations/appointments.functions";
import { formatoFechaLarga, type Cita } from "@/lib/clinic-operations/clinic-data";
import { buildWaMeUrl } from "@/lib/messaging/messaging";
import { listPatients } from "@/lib/patients/patients.functions";
import { cn } from "@/lib/utils";

function hora(inicio: number) {
  const t = 8 * 60 + inicio;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/**
 * Cola de confirmación para el celular de recepción (rediseño fase 5, panel
 * 1e): citas de hoy y mañana sin aviso del paciente, en tarjetas con
 * objetivos de 44px. "Confirmó" anota `patient_confirmed_at` — el eje del
 * PACIENTE, nunca el estado del profesional (ver CLAUDE.md, webhook) — así
 * que desde "Hoy" queda a un toque.
 */
export function ColaConfirmacion({
  clinicId,
  clinicaNombre,
  citas,
  hoy,
  nombreProfesional,
}: {
  clinicId: string;
  clinicaNombre: string;
  citas: Cita[];
  hoy: string;
  nombreProfesional: Map<string, string>;
}) {
  const queryClient = useQueryClient();
  const marcar = useServerFn(setPatientConfirmation);
  const fetchPatients = useServerFn(listPatients);

  const pendientes = useMemo(() => {
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    const mananaISO = manana.toISOString().slice(0, 10);
    return citas
      .filter(
        (c) =>
          (c.fecha === hoy || c.fecha === mananaISO) &&
          c.estado === "tentativa" &&
          !c.pacienteConfirmo,
      )
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicio - b.inicio);
  }, [citas, hoy]);

  // Mismo queryKey que /pacientes: comparte caché. Solo para los teléfonos.
  const { data: telefonos } = useQuery({
    queryKey: ["patients", clinicId],
    enabled: pendientes.length > 0,
    queryFn: () => fetchPatients({ data: { clinicId } }),
    select: (res) => new Map(res.items.map((p) => [p.id, p.telefono])),
  });

  const confirmar = useMutation({
    mutationFn: (appointmentId: string) =>
      marcar({ data: { appointmentId, confirmado: true, via: "telefono" } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appointments", clinicId] });
      toast.success("Anotado: el paciente avisó que viene.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (pendientes.length === 0) return null;

  return (
    <section aria-labelledby="por-confirmar" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 id="por-confirmar" className="font-display text-2xl font-semibold">
          {pendientes.length} por confirmar
        </h2>
        <span className="kicker">Hoy y mañana</span>
      </div>
      <ul className="space-y-3">
        {pendientes.map((c) => {
          const tel = telefonos?.get(c.pacienteId) || null;
          const dia = c.fecha === hoy ? "hoy" : formatoFechaLarga(c.fecha);
          const wa = tel
            ? buildWaMeUrl(
                tel,
                `Hola ${c.paciente.split(" ")[0]}, te escribimos de ${clinicaNombre} para confirmar tu cita de ${dia} a las ${hora(c.inicio)}. ¿Nos confirmas?`,
              )
            : null;
          const enviando = confirmar.isPending && confirmar.variables === c.id;
          return (
            <li key={c.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <Link
                  to="/pacientes/$pacienteId"
                  params={{ pacienteId: c.pacienteId }}
                  className="min-w-0"
                >
                  <span className="block truncate text-base font-medium">{c.paciente}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {c.tratamiento} · {nombreProfesional.get(c.profesionalId) ?? "—"}
                  </span>
                </Link>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-2xl leading-none tabular-nums">
                    {hora(c.inicio)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {c.fecha === hoy ? "Hoy" : "Mañana"}
                  </span>
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <a
                  href={tel ? `tel:${tel}` : undefined}
                  aria-disabled={!tel}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-11",
                    !tel && "pointer-events-none opacity-45",
                  )}
                >
                  <Phone aria-hidden /> Llamar
                </a>
                <a
                  href={wa ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!wa}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-11",
                    !wa && "pointer-events-none opacity-45",
                  )}
                >
                  <MessageCircle aria-hidden /> WhatsApp
                </a>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => confirmar.mutate(c.id)}
                  className={cn(buttonVariants(), "h-11")}
                >
                  <Check aria-hidden /> {enviando ? "…" : "Confirmó"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
