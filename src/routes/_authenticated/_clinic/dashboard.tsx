import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarPlus, Check, Lock, Sparkles, UserPlus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ColaConfirmacion } from "@/components/cola-confirmacion";
import { EstadoCitaPastilla } from "@/components/estado-cita-pastilla";
import { PanelDesempeno } from "@/components/panel-desempeno";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/access/route-guards";
import { hasPermission } from "@/lib/access/access";
import { listClinicMembers } from "@/lib/access/access.functions";
import { getMySubscription } from "@/lib/billing.functions";
import { trialInformesBloqueados } from "@/lib/billing";
import {
  formatoFecha,
  formatoFechaLarga,
  hoyISO,
  type Cita,
} from "@/lib/clinic-operations/clinic-data";
import { listProfessionals } from "@/lib/clinic-operations/clinic-catalog.functions";
import {
  getAppointmentPatientBalances,
  listAppointments,
} from "@/lib/clinic-operations/appointments.functions";
import { getFinanceSummary } from "@/lib/finance/finance-reports.functions";
import { formatMoney } from "@/lib/finance/finance";
import { countConversacionesSinResponder } from "@/lib/messaging/conversations.functions";
import { listPendingOutreach, listPendingReminders } from "@/lib/messaging/messaging.functions";
import { listPatients } from "@/lib/patients/patients.functions";
import { claseTexto, type TonoEstado } from "@/lib/clinic-operations/estado-cita-tono";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_clinic/dashboard")({
  beforeLoad: requirePermission("dashboard:view"),
  head: () => ({
    meta: [
      { title: "Hoy | Alika" },
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

// `inicio` llega como minutos desde las 8:00 de la sucursal (no desde
// medianoche) — mismo criterio que usa el resto de la agenda para acotar la
// jornada laboral. Si esa semántica cambia en el backend, acá es donde hay
// que ajustar el offset.
function horaDeCita(inicio: number) {
  const total = 8 * 60 + inicio;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

type PasoActivacion = {
  hecho: boolean;
  label: string;
  to?: "/pacientes" | "/agenda" | "/equipo";
  cta?: string;
};

/**
 * Checklist "Activa tu clínica" (benchmark de onboarding, 25-sep-2026; forma
 * del rediseño, panel 1c). Se deriva de datos reales y desaparece sola cuando
 * todo está hecho: no hay botón de cerrar porque no hace falta.
 */
function ChecklistActivacion({ pasos }: { pasos: PasoActivacion[] }) {
  if (pasos.every((p) => p.hecho)) return null;
  const hechos = pasos.filter((p) => p.hecho).length;

  return (
    <section aria-labelledby="activacion" className="rounded-lg border border-border p-5">
      <h2 id="activacion" className="kicker">
        Activa tu clínica · {hechos} de {pasos.length}
      </h2>
      <ul className="mt-4 space-y-3">
        {pasos.map((paso) => (
          <li key={paso.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border",
                  paso.hecho ? "border-success text-success" : "border-border",
                )}
              >
                {paso.hecho && <Check className="size-3" />}
              </span>
              <span className={cn(paso.hecho && "text-muted-foreground line-through")}>
                {paso.label}
                <span className="sr-only">{paso.hecho ? " (hecho)" : " (pendiente)"}</span>
              </span>
            </span>
            {!paso.hecho && paso.to && (
              <Link to={paso.to} className="shrink-0 text-xs text-brand-700 hover:underline">
                {paso.cta} →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** `tono` colorea la cifra y `tonoNota` la nota solo cuando hay algo que
 * mirar (auditoría 07-oct-2026: las cifras de Hoy eran todas tinta). */
type Kpi = { label: string; valor: string; nota: string; tono?: TonoEstado; tonoNota?: TonoEstado };

function FilaKpis({ kpis, cargando }: { kpis: Kpi[]; cargando: boolean }) {
  return (
    <dl className="grid grid-cols-2 border-y border-border md:grid-cols-4">
      {kpis.map((k, i) => (
        <div
          key={k.label}
          className={cn(
            "px-5 py-5 first:pl-0",
            i % 2 === 1 && "border-l border-hairline",
            i >= 2 && "border-t border-hairline md:border-t-0",
            i === 2 && "pl-0 md:border-l md:pl-5",
            i === 3 && "md:border-l",
          )}
        >
          <dt className="kicker">{k.label}</dt>
          <dd
            className={cn(
              "mt-2 font-display text-4xl font-normal leading-none tabular-nums",
              k.tono && claseTexto[k.tono],
            )}
          >
            {cargando ? (
              <span
                className="inline-block h-9 w-14 animate-pulse rounded-sm bg-muted"
                aria-label="Cargando"
              />
            ) : (
              k.valor
            )}
          </dd>
          <dd
            className={cn(
              "mt-1.5 text-sm",
              k.tonoNota ? claseTexto[k.tonoNota] : "text-muted-foreground",
            )}
          >
            {k.nota}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Siempre con texto: el tono acompaña, no informa solo (auditoría 04-sep).
 * Forma + ícono por estado desde el 08-oct (dirección híbrida). */
function EstadoCita({ cita }: { cita: Cita }) {
  return <EstadoCitaPastilla cita={cita} />;
}

type Tarea = { n: number; titulo: string; detalle: string; cta: string; to: string };

function ColaAccionable({ tareas }: { tareas: Tarea[] }) {
  return (
    <section aria-labelledby="cola" className="rounded-lg border border-border">
      <h2
        id="cola"
        className="border-b border-hairline px-5 py-4 font-display text-xl font-semibold"
      >
        Para resolver hoy
      </h2>
      {tareas.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          Nada pendiente por ahora. Lo que necesite tu atención va a aparecer acá.
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {tareas.map((t) => (
            <li key={t.titulo} className="flex items-center gap-4 px-5 py-4">
              <span className="w-8 shrink-0 font-display text-3xl font-normal leading-none tabular-nums text-brand-700">
                {t.n > 99 ? "99+" : t.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{t.titulo}</span>
                <span className="block truncate text-xs text-muted-foreground">{t.detalle}</span>
              </span>
              <Link to={t.to} className={buttonVariants({ size: "sm", variant: "outline" })}>
                {t.cta}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function saludo(timezone: string | undefined) {
  const hora = Number(
    new Intl.DateTimeFormat("es-CL", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: timezone || "America/Santiago",
    }).format(new Date()),
  );
  if (hora < 12) return "Buen día";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

/**
 * Variante compacta de `TrialDesbloqueo` para el panel de desempeño del
 * dashboard (Task 11, fix round 1 — Critical #1).
 *
 * `TrialDesbloqueo` completo (grilla de dos columnas a página completa) no
 * entra bien acá: el dashboard ya tiene su propia agenda del día y KPIs
 * debajo, y esta sección es solo UNA de varias, no la pantalla entera. Lo que
 * sí hereda es la regla que importa: nunca un error rojo genérico donde en
 * realidad es un trial vencido — el estado tiene que decir la verdad.
 */
function DesempenoBloqueado() {
  return (
    <div className="card-clinical flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Lock className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium">El panel de desempeño se activa al suscribirte</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tu trial de 14 días terminó. La agenda y el resto de la clínica siguen funcionando con
            total normalidad.
          </p>
        </div>
      </div>
      <Link
        to="/suscripcion"
        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-brand bg-transparent px-4 py-2 text-xs font-medium text-brand-700 transition-opacity hover:bg-brand/12"
      >
        <Sparkles className="size-3.5" /> Activar suscripción
      </Link>
    </div>
  );
}

function Dashboard() {
  const { access } = Route.useRouteContext();
  const clinicId = access.clinic?.id;
  const clinicTz = access.clinic?.timezone;
  const currency = access.clinic?.currency ?? "CLP";
  const hoy = hoyISO(clinicTz);

  const veFinanzas = hasPermission(access.role, "finance:view");
  const gestionaAgenda = hasPermission(access.role, "agenda:manage");

  const fetchPatients = useServerFn(listPatients);
  const fetchAppointments = useServerFn(listAppointments);
  const fetchProfessionals = useServerFn(listProfessionals);
  const fetchBalances = useServerFn(getAppointmentPatientBalances);
  const fetchFinance = useServerFn(getFinanceSummary);
  const fetchSubscription = useServerFn(getMySubscription);
  const fetchMembers = useServerFn(listClinicMembers);
  const fetchReminders = useServerFn(listPendingReminders);
  const fetchOutreach = useServerFn(listPendingOutreach);
  const fetchSinResponder = useServerFn(countConversacionesSinResponder);

  // Mismo queryKey que TrialBanner / StatusStrip / informes: comparten caché.
  // Con trial vencido, `getPanelDesempeno` y `getFinanceSummary` rechazan
  // (`requireFinanceView`): el panel lo dice en vez de mostrar un error rojo.
  const { data: sub } = useQuery({
    queryKey: ["my-subscription", clinicId],
    queryFn: () => fetchSubscription({ data: { clinicId: clinicId! } }),
    enabled: Boolean(clinicId),
    staleTime: 60 * 1000,
  });
  const informesBloqueados = trialInformesBloqueados(sub ?? null);

  // Ventana hoy..+2 días: alcanza para la agenda de hoy y la cola de "sin
  // confirmar 48 h" (antes traía 30 días para cuatro tarjetas genéricas).
  const hasta = useMemo(() => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  }, [hoy]);
  const {
    data: citas = [],
    isLoading,
    isError: citasConError,
    refetch: reintentarCitas,
  } = useQuery({
    queryKey: ["appointments", clinicId, hoy, hasta],
    enabled: Boolean(clinicId),
    queryFn: () => fetchAppointments({ data: { clinicId: clinicId!, desde: hoy, hasta } }),
    select: (res) => res.items,
  });
  const { data: profesionales = [] } = useQuery({
    queryKey: ["professionals", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchProfessionals({ data: { clinicId: clinicId! } }),
  });

  const citasHoy = useMemo(
    () => citas.filter((c) => c.fecha === hoy).sort((a, b) => a.inicio - b.inicio),
    [citas, hoy],
  );
  const nombreProfesional = useMemo(
    () => new Map(profesionales.map((p) => [p.id, p.nombre])),
    [profesionales],
  );

  const pacientesHoy = useMemo(
    () => [...new Set(citasHoy.map((c) => c.pacienteId))].sort(),
    [citasHoy],
  );
  const {
    data: saldos = {},
    isPending: saldosPendientes,
    isError: saldosConError,
  } = useQuery({
    queryKey: ["appointment-balances", clinicId, pacientesHoy],
    enabled: Boolean(clinicId) && veFinanzas && pacientesHoy.length > 0,
    queryFn: () => fetchBalances({ data: { clinicId: clinicId!, patientIds: pacientesHoy } }),
  });
  const { data: cajaHoy } = useQuery({
    queryKey: ["finance-summary", clinicId, hoy, hoy],
    // Esperar a conocer la suscripción: con el trial vencido el servidor
    // rechaza este informe, y mientras `sub` carga `informesBloqueados` es false.
    enabled: Boolean(clinicId) && veFinanzas && sub !== undefined && !informesBloqueados,
    queryFn: () => fetchFinance({ data: { clinicId: clinicId!, desde: hoy, hasta: hoy } }),
  });

  // Colas: mismos queryKeys que el badge de Mensajes del sidebar.
  const { data: recordatorios = [] } = useQuery({
    queryKey: ["pending-reminders", clinicId],
    enabled: Boolean(clinicId) && gestionaAgenda,
    queryFn: () => fetchReminders({ data: { clinicId: clinicId! } }),
    refetchInterval: 5 * 60_000,
  });
  const { data: outreach = [] } = useQuery({
    queryKey: ["pending-outreach", clinicId],
    enabled: Boolean(clinicId) && gestionaAgenda,
    queryFn: () => fetchOutreach({ data: { clinicId: clinicId! } }),
    refetchInterval: 5 * 60_000,
  });
  const { data: sinResponder = 0 } = useQuery({
    queryKey: ["conversations-pendientes", clinicId],
    enabled: Boolean(clinicId) && gestionaAgenda,
    queryFn: () => fetchSinResponder({ data: { clinicId: clinicId! } }),
    refetchInterval: 2 * 60_000,
  });

  // Checklist de activación: solo para el dueño, con datos reales. En la
  // clínica demo no va: ya viene sembrada y es de solo lectura, así que
  // "Activa tu clínica" invitaría a pasos que el visitante no puede hacer.
  const esDueno = access.role === "owner";
  const mostrarActivacion = esDueno && !access.clinic?.isDemo;
  const { data: hayPacientes } = useQuery({
    queryKey: ["patients", clinicId],
    enabled: Boolean(clinicId) && mostrarActivacion,
    queryFn: () => fetchPatients({ data: { clinicId: clinicId! } }),
    select: (res) => res.items.length > 0,
  });
  const { data: miembros = [] } = useQuery({
    queryKey: ["clinic-members", clinicId],
    enabled: Boolean(clinicId) && mostrarActivacion,
    queryFn: () => fetchMembers({ data: { clinicId: clinicId! } }),
  });

  // ── Derivados ────────────────────────────────────────────────────
  const confirmadas = citasHoy.filter((c) =>
    ["confirmada", "en-sala", "finalizada"].includes(c.estado),
  ).length;
  const sinRespuestaHoy = citasHoy.filter(
    (c) => c.estado === "tentativa" && !c.pacienteConfirmo,
  ).length;
  const enSala = citasHoy.filter((c) => c.estado === "en-sala");
  const profesionalesHoy = new Set(citasHoy.map((c) => c.profesionalId)).size;
  const conDeuda = pacientesHoy.filter((id) => (saldos[id] ?? 0) > 0);
  const porCobrarHoy = conDeuda.reduce((s, id) => s + (saldos[id] ?? 0), 0);
  const sinConfirmar48h = citas.filter(
    (c) => c.estado === "tentativa" && !c.pacienteConfirmo,
  ).length;

  const kpiCitas: Kpi = {
    label: "Citas hoy",
    valor: String(citasHoy.length),
    nota: `${profesionalesHoy} profesional${profesionalesHoy === 1 ? "" : "es"}`,
  };
  const kpiConfirmadas: Kpi = {
    label: "Confirmadas",
    valor: String(confirmadas),
    nota: `${sinRespuestaHoy} sin respuesta`,
    tono: confirmadas > 0 ? "success" : undefined,
    tonoNota: sinRespuestaHoy > 0 ? "warning" : undefined,
  };
  // Regla 11: mientras los saldos cargan (o si fallan) no se fabrica un $0.
  const saldosSinDatos = pacientesHoy.length > 0 && (saldosPendientes || saldosConError);
  const kpiPorCobrar: Kpi = saldosSinDatos
    ? {
        label: "Por cobrar hoy",
        valor: "—",
        nota: saldosConError ? "Sin datos" : "Cargando…",
      }
    : {
        label: "Por cobrar hoy",
        valor: formatMoney(porCobrarHoy, currency),
        nota: `${conDeuda.length} paciente${conDeuda.length === 1 ? "" : "s"}`,
        tono: porCobrarHoy > 0 ? "warning" : undefined,
      };
  // Dueño y contabilidad (finance:view): plata primero. Recepción y el
  // equipo clínico: el movimiento del día. "Por cobrar" exige finance:view
  // también en el servidor, así que no se le ofrece a quien no lo tiene.
  const kpis: Kpi[] = veFinanzas
    ? [
        {
          label: "Cobrado hoy",
          valor: informesBloqueados || !cajaHoy ? "—" : formatMoney(cajaHoy.totalCents, currency),
          nota: informesBloqueados
            ? "Se activa al suscribirte"
            : !cajaHoy
              ? "Cargando…"
              : `${cajaHoy.paymentsCount} pago${cajaHoy.paymentsCount === 1 ? "" : "s"}`,
        },
        kpiPorCobrar,
        kpiCitas,
        kpiConfirmadas,
      ]
    : [
        kpiCitas,
        kpiConfirmadas,
        {
          label: "En sala",
          valor: String(enSala.length),
          tono: enSala.length > 0 ? "info" : undefined,
          nota: enSala[0]
            ? `${enSala[0].paciente} · ${horaDeCita(enSala[0].inicio)}`
            : "Nadie esperando",
        },
        {
          label: "Sin confirmar",
          valor: String(sinConfirmar48h),
          nota: "Próximas 48 h",
          tono: sinConfirmar48h > 0 ? "warning" : undefined,
        },
      ];

  const tareas: Tarea[] = [
    ...(gestionaAgenda
      ? [
          {
            n: sinConfirmar48h,
            titulo: "Citas sin confirmar",
            detalle: "Hoy y los próximos 2 días",
            cta: "Revisar",
            to: "/recordatorios",
          },
          {
            n: sinResponder,
            titulo: "Mensajes sin responder",
            detalle: "Pacientes que escribieron por WhatsApp",
            cta: "Responder",
            to: "/conversaciones",
          },
          {
            n: recordatorios.length + outreach.length,
            titulo: "Avisos para despachar",
            detalle: "Recordatorios, controles y presupuestos",
            cta: "Avisar",
            to: "/recordatorios",
          },
        ]
      : []),
    ...(veFinanzas
      ? [
          {
            n: conDeuda.length,
            titulo: "Pacientes de hoy con saldo",
            detalle: "Cobrar antes de que pasen al box",
            cta: "Ver",
            to: "/morosidad",
          },
        ]
      : []),
  ].filter((t) => t.n > 0);

  const pasosActivacion: PasoActivacion[] = [
    { hecho: true, label: "Crear la clínica" },
    {
      hecho: miembros.length > 1,
      label: "Invitar al equipo",
      to: "/equipo",
      cta: "Invitar",
    },
    {
      hecho: Boolean(hayPacientes),
      label: "Importar o cargar pacientes",
      to: "/pacientes",
      cta: "Ir a pacientes",
    },
    {
      // `citas` mira hoy..+2 días: heurística de checklist, no una métrica.
      hecho: citas.length > 0,
      label: "Agendar la primera cita",
      to: "/agenda",
      cta: "Ir a la agenda",
    },
  ];

  // El nombre puede venir guardado en minúsculas ("walter la madriz").
  const nombre = (access.fullName ?? "").trim().split(/\s+/)[0] ?? "";
  const primerNombre = nombre ? nombre[0].toLocaleUpperCase("es") + nombre.slice(1) : "";
  const primerDiaDelMes = `${hoy.slice(0, 7)}-01`;

  return (
    <AppShell title="Hoy" access={access}>
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">{formatoFechaLarga(hoy)}</p>
            <h2 className="mt-2 font-display text-4xl font-normal leading-none sm:text-[44px]">
              {saludo(clinicTz)}
              {primerNombre ? `, ${primerNombre}` : ""}.
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasPermission(access.role, "patients:manage") && (
              <Link
                to="/pacientes"
                search={{
                  q: "",
                  sucursal: "",
                  profesional: "",
                  estado: "",
                  desde: "",
                  hasta: "",
                  page: 1,
                }}
                className={buttonVariants({ variant: "outline" })}
              >
                <UserPlus aria-hidden /> Nuevo paciente
              </Link>
            )}
            {gestionaAgenda && (
              <Link
                to="/agenda"
                search={{
                  q: "",
                  fecha: hoy,
                  vista: "dia",
                  sucursal: "",
                  profesional: "",
                  estado: "",
                  page: 1,
                }}
                className={buttonVariants()}
              >
                <CalendarPlus aria-hidden /> Agendar cita
              </Link>
            )}
          </div>
        </header>

        {/* Celular de recepción: la cola de confirmación va primero, a un
            toque de "Confirmó" (rediseño fase 5, panel 1e). */}
        {clinicId && gestionaAgenda && (
          <div className="md:hidden">
            <ColaConfirmacion
              clinicId={clinicId}
              clinicaNombre={access.clinic?.name ?? "la clínica"}
              citas={citas}
              hoy={hoy}
              nombreProfesional={nombreProfesional}
            />
          </div>
        )}

        <FilaKpis kpis={kpis} cargando={isLoading} />

        <div className="grid gap-8 xl:grid-cols-[1.5fr_1fr]">
          <section aria-labelledby="agenda-hoy" className="min-w-0">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="agenda-hoy" className="font-display text-2xl font-semibold">
                Agenda de hoy
              </h2>
              <Link
                to="/agenda"
                search={{
                  q: "",
                  fecha: hoy,
                  vista: "dia",
                  sucursal: "",
                  profesional: "",
                  estado: "",
                  page: 1,
                }}
                className="text-sm text-brand-700 hover:underline"
              >
                Abrir agenda →
              </Link>
            </div>
            {citasConError ? (
              // Un error no es "no hay citas": antes se mostraba igual y la
              // recepción creía que el día estaba libre (auditoría 07-oct).
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 border-y border-destructive-border bg-destructive-soft px-4 py-5 text-sm text-destructive"
              >
                No pudimos cargar la agenda de hoy. Revisa la conexión.
                <button
                  type="button"
                  onClick={() => void reintentarCitas()}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Reintentar
                </button>
              </div>
            ) : citasHoy.length === 0 ? (
              <p className="border-y border-border py-8 text-sm text-muted-foreground">
                {isLoading ? "Cargando la agenda…" : "No hay citas para hoy."}
              </p>
            ) : (
              <>
                {/* Celular: tarjetas. La tabla de 34rem obligaba a deslizar de
                  costado a 390px. */}
                <ul className="divide-y divide-hairline border-y border-border md:hidden">
                  {citasHoy.map((c) => {
                    const saldo = saldos[c.pacienteId];
                    return (
                      <li key={c.id}>
                        <Link
                          to="/pacientes/$pacienteId"
                          params={{ pacienteId: c.pacienteId }}
                          className="flex items-start gap-3 py-3"
                        >
                          <span className="w-12 shrink-0 pt-0.5 tabular-nums text-muted-foreground">
                            {horaDeCita(c.inicio)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{c.paciente}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {c.tratamiento} · {nombreProfesional.get(c.profesionalId) ?? "—"}
                            </span>
                            {veFinanzas && saldo !== undefined && saldo > 0 && (
                              <span className="mt-0.5 block text-xs tabular-nums text-warning">
                                Debe {formatMoney(saldo, currency)}
                              </span>
                            )}
                          </span>
                          <EstadoCita cita={c} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <div className="hidden overflow-x-auto border-y border-border md:block">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead>
                      <tr className="kicker text-left">
                        <th scope="col" className="py-2.5 pr-3 font-normal">
                          Hora
                        </th>
                        <th scope="col" className="py-2.5 pr-3 font-normal">
                          Paciente
                        </th>
                        <th scope="col" className="py-2.5 pr-3 font-normal">
                          Profesional
                        </th>
                        <th scope="col" className="py-2.5 pr-3 font-normal">
                          Estado
                        </th>
                        {veFinanzas && (
                          <th scope="col" className="py-2.5 text-right font-normal">
                            Saldo
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {citasHoy.map((c) => {
                        const saldo = saldos[c.pacienteId];
                        return (
                          <tr key={c.id} className="align-middle">
                            <td className="py-3 pr-3 tabular-nums text-muted-foreground">
                              {horaDeCita(c.inicio)}
                            </td>
                            <td className="py-3 pr-3">
                              <Link
                                to="/pacientes/$pacienteId"
                                params={{ pacienteId: c.pacienteId }}
                                className="block hover:text-brand-700"
                              >
                                {c.paciente}
                              </Link>
                              <span className="block text-xs text-muted-foreground">
                                {c.tratamiento}
                              </span>
                            </td>
                            <td className="py-3 pr-3 text-foreground/80">
                              {nombreProfesional.get(c.profesionalId) ?? "—"}
                            </td>
                            <td className="py-3 pr-3">
                              <EstadoCita cita={c} />
                            </td>
                            {veFinanzas && (
                              <td className="py-3 text-right tabular-nums">
                                {saldo === undefined
                                  ? "—"
                                  : saldo > 0
                                    ? formatMoney(saldo, currency)
                                    : saldo < 0
                                      ? `A favor ${formatMoney(-saldo, currency)}`
                                      : "Al día"}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <div className="space-y-6">
            {/* Escritorio: la misma cola de confirmación del celular, con
                "Confirmó" a un clic (antes solo existía en md:hidden). */}
            {clinicId && gestionaAgenda && (
              <div className="hidden md:block">
                <ColaConfirmacion
                  clinicId={clinicId}
                  clinicaNombre={access.clinic?.name ?? "la clínica"}
                  citas={citas}
                  hoy={hoy}
                  nombreProfesional={nombreProfesional}
                />
              </div>
            )}
            <ColaAccionable tareas={tareas} />
            {clinicId && mostrarActivacion && <ChecklistActivacion pasos={pasosActivacion} />}
          </div>
        </div>

        {clinicId && veFinanzas && (
          <section aria-labelledby="desempeno" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="desempeno" className="font-display text-2xl font-semibold">
                Desempeño del mes
              </h2>
              <p className="text-sm text-muted-foreground">
                {formatoFecha(primerDiaDelMes)} — {formatoFecha(hoy)}
              </p>
            </div>
            {informesBloqueados ? (
              <DesempenoBloqueado />
            ) : (
              <PanelDesempeno clinicId={clinicId} desde={primerDiaDelMes} hasta={hoy} />
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
