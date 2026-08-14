import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { requirePermission } from "@/lib/route-guards";
import { AgendaGrid } from "@/components/agenda-grid";
import { formatoFecha, hoyISO } from "@/lib/clinic-data";
import { listProfessionals } from "@/lib/clinic-catalog.functions";
import { listPatients } from "@/lib/patients.functions";
import { listAppointments } from "@/lib/appointments.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_clinic/dashboard")({
  beforeLoad: requirePermission("dashboard:view"),
  head: () => ({
    meta: [
      { title: "Dashboard clínico | Alika" },
      {
        name: "description",
        content: "Alika: KPIs en vivo y agenda del día de tu clínica dental.",
      },
      { property: "og:title", content: "Dashboard clínico | Alika" },
      {
        property: "og:description",
        content: "KPIs en vivo y agenda del día de tu clínica dental.",
      },
    ],
  }),
  component: Dashboard,
});

function horaDeCita(inicio: number) {
  const total = 8 * 60 + inicio;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function Dashboard() {
  const { access } = Route.useRouteContext();
  const clinicId = access.clinic?.id;
  const clinicTz = access.clinic?.timezone;

  const fetchPatients = useServerFn(listPatients);
  const fetchAppointments = useServerFn(listAppointments);
  const fetchProfessionals = useServerFn(listProfessionals);

  const { data: pacientes = [] } = useQuery({
    queryKey: ["patients", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchPatients({ data: { clinicId: clinicId! } }),
  });
  const { data: citas = [], isLoading } = useQuery({
    queryKey: ["appointments", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchAppointments({ data: { clinicId: clinicId! } }),
  });
  const { data: profesionales = [] } = useQuery({
    queryKey: ["professionals", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchProfessionals({ data: { clinicId: clinicId! } }),
  });

  const hoy = hoyISO(clinicTz);

  const citasHoy = useMemo(() => citas.filter((c) => c.fecha === hoy), [citas, hoy]);
  const en7Dias = useMemo(() => {
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + 7);
    const limiteISO = limite.toISOString().slice(0, 10);
    return citas.filter((c) => c.fecha >= hoy && c.fecha <= limiteISO);
  }, [citas, hoy]);
  const pacientesNuevos = useMemo(
    () => pacientes.filter((p) => p.estado === "nuevo").length,
    [pacientes],
  );

  const proximasCitas = useMemo(
    () =>
      [...citas]
        .filter((c) => c.fecha >= hoy)
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicio - b.inicio)
        .slice(0, 6),
    [citas, hoy],
  );

  const kpis = [
    { label: "Pacientes totales", valor: pacientes.length, nota: "Clínica completa" },
    { label: "Citas hoy", valor: citasHoy.length, nota: formatoFecha(hoy) },
    { label: "Próximos 7 días", valor: en7Dias.length, nota: "Citas agendadas" },
    { label: "Pacientes nuevos", valor: pacientesNuevos, nota: "Estado: nuevo" },
  ];

  return (
    <AppShell title="Vista de clínica" access={access}>
      <div className="space-y-8">
        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="card-clinical p-5">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{k.label}</p>
              <p className="font-display text-3xl font-bold">{isLoading ? "—" : k.valor}</p>
              <div className="mt-2 inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {k.nota}
              </div>
            </div>
          ))}
        </section>

        <div className="grid gap-8 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Agenda de hoy</h2>
              <Link
                to="/agenda"
                search={{ q: "", fecha: hoy, sucursal: "", profesional: "", estado: "", page: 1 }}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
              >
                Abrir agenda
              </Link>
            </div>
            <AgendaGrid compacta citas={citasHoy} profesionales={profesionales} />
          </div>

          <div className="space-y-4 xl:col-span-4">
            <h2 className="font-display text-xl font-semibold text-muted-foreground">
              Próximas citas
            </h2>
            <div className="card-clinical space-y-1 p-3">
              {proximasCitas.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">
                  No hay citas próximas agendadas.
                </p>
              )}
              {proximasCitas.map((c) => (
                <Link
                  key={c.id}
                  to="/pacientes/$pacienteId"
                  params={{ pacienteId: c.pacienteId }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/60"
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-lg",
                      c.fecha === hoy
                        ? "bg-brand-soft text-brand"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    <CalendarClock className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.paciente}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.tratamiento}</p>
                  </div>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    <p>{c.fecha === hoy ? "Hoy" : formatoFecha(c.fecha)}</p>
                    <p>{horaDeCita(c.inicio)}</p>
                  </span>
                </Link>
              ))}
            </div>

            <div className="card-clinical space-y-2 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ai">
                <Sparkles className="size-3" /> Análisis predictivo IA
              </p>
              <p className="text-xs italic text-muted-foreground">
                Próximamente: lectura automática de lo que está pasando en la clínica, una vez que
                haya suficiente actividad real registrada.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
