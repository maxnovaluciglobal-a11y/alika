import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { DateField, FilterBar, Paginacion, SearchField, SelectField } from "@/components/filters";
import { AgendaGrid } from "@/components/agenda-grid";
import { AgendaMonth, AgendaWeek } from "@/components/agenda-views";
import { AllergyAlertBanner, AllergyAlertIcon } from "@/components/medical-history-card";
import { PatientCombobox } from "@/components/patient-combobox";
import { addDaysISO, addMonthsISO, rangoDeVista } from "@/lib/agenda-fechas";
import { Button } from "@/components/ui/button";
import { HolidayNotice } from "@/components/holiday-notice";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { usePublicHolidays } from "@/hooks/use-public-holidays";
import { useOfflineMutation } from "@/hooks/use-offline-mutation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { requirePermission } from "@/lib/route-guards";
import { hasPermission, type ClinicAccess } from "@/lib/access";
import {
  etiquetaEstado,
  formatoFechaLarga,
  HORA_INICIO,
  hoyISO,
  type Cita,
  type EstadoCita,
} from "@/lib/clinic-data";

// Fallback para el default de validateSearch (no tiene acceso al contexto
// de la ruta ni a la clínica activa). Dentro del componente usamos la
// timezone real de la clínica vía access.clinic?.timezone.
const HOY = hoyISO();
import { listBranches, listProfessionals } from "@/lib/clinic-catalog.functions";
import { listProcedures } from "@/lib/finance.functions";
import { formatMoney } from "@/lib/finance";
import { listPatients } from "@/lib/patients.functions";
import { listAllergyAlerts } from "@/lib/medical-history.functions";
import { getAppointmentPatientBalances } from "@/lib/appointments.functions";
import {
  createAppointment,
  listAppointments,
  setAppointmentStatus,
  updateAppointment,
  type Solapamiento,
} from "@/lib/appointments.functions";
import { createWaitlistEntry, listWaitlist, removeWaitlistEntry } from "@/lib/waitlist.functions";
import {
  declineAppointmentRequest,
  listPendingAppointmentRequests,
  markAppointmentRequestScheduled,
  type PendingAppointmentRequest,
} from "@/lib/portal.functions";
import { coincide, num, paginar, str } from "@/lib/search";
import { cn } from "@/lib/utils";

type VistaAgenda = "dia" | "semana" | "mes";

/** Mueve la fecha un período hacia adelante/atrás según la vista activa. */
function desplazarPeriodo(vista: VistaAgenda, fecha: string, dir: 1 | -1): string {
  if (vista === "semana") return addDaysISO(fecha, dir * 7);
  if (vista === "mes") return addMonthsISO(fecha, dir);
  return addDaysISO(fecha, dir);
}

/** Título del período visible: día largo, rango de semana, o mes + año. */
function labelPeriodo(vista: VistaAgenda, fecha: string): string {
  if (vista === "dia") return formatoFechaLarga(fecha) || fecha;
  const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
  if (vista === "mes") {
    return new Intl.DateTimeFormat("es", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(parse(fecha));
  }
  const [desde, hasta] = rangoDeVista("semana", fecha);
  const d = parse(desde);
  const h = parse(hasta);
  const dia = (x: Date) =>
    new Intl.DateTimeFormat("es", { day: "numeric", timeZone: "UTC" }).format(x);
  const mesAnio = (x: Date) =>
    new Intl.DateTimeFormat("es", { month: "short", year: "numeric", timeZone: "UTC" }).format(x);
  return d.getUTCMonth() === h.getUTCMonth()
    ? `${dia(d)}–${dia(h)} ${mesAnio(h)}`
    : `${dia(d)} ${mesAnio(d)} – ${dia(h)} ${mesAnio(h)}`;
}

interface AgendaSearch {
  q: string;
  fecha: string;
  vista: VistaAgenda;
  sucursal: string;
  profesional: string;
  estado: string;
  page: number;
}

function parseVista(v: unknown): VistaAgenda {
  return v === "semana" || v === "mes" ? v : "dia";
}

export const Route = createFileRoute("/_authenticated/_clinic/agenda")({
  validateSearch: (search: Record<string, unknown>): AgendaSearch => ({
    q: str(search.q),
    fecha: str(search.fecha, HOY),
    vista: parseVista(search.vista),
    sucursal: str(search.sucursal),
    profesional: str(search.profesional),
    estado: str(search.estado),
    page: num(search.page, 1),
  }),
  beforeLoad: requirePermission("agenda:view"),
  head: () => ({
    meta: [
      { title: "Agenda inteligente | Alika" },
      {
        name: "description",
        content:
          "Agenda por fecha, profesional, sucursal y estado, con lista de espera inteligente.",
      },
      { property: "og:title", content: "Agenda inteligente | Alika" },
      {
        property: "og:description",
        content:
          "Agenda filtrable por fecha, profesional, sucursal y estado, con lista de espera inteligente.",
      },
    ],
  }),
  component: AgendaPage,
});

const estados: { value: EstadoCita; label: string }[] = (
  ["confirmada", "en-sala", "ausente", "finalizada", "tentativa"] as EstadoCita[]
).map((e) => ({ value: e, label: etiquetaEstado[e] }));

function horaDeCita(minutos: number) {
  const total = HORA_INICIO * 60 + minutos;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * `createAppointment` avisa (no bloquea) cuando la cita recién creada se
 * solapa con otra del mismo profesional — ver el comentario en
 * appointments.functions.ts. La hora se muestra en la zona horaria del
 * navegador (aproximada): es un aviso para que el staff decida, no un dato
 * que otra parte del sistema use.
 */
function avisarSiSolapa(resultado: unknown) {
  const solapamiento = (resultado as { solapamiento?: Solapamiento } | undefined)?.solapamiento;
  if (!solapamiento) return;
  const hora = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(solapamiento.startsAt),
  );
  toast.warning(
    `Ojo: ${solapamiento.treatmentLabel} ya está agendado a las ${hora} con este profesional. La cita se creó igual — revisa si hace falta reagendar.`,
  );
}

/**
 * Mismos 6 valores que el enum de `setAppointmentStatus`
 * (appointments.functions.ts). "cancelada" no está en `EstadoCita`
 * (clinic-data.ts) porque `listAppointments` excluye las citas canceladas de
 * la agenda — pero sigue siendo un destino válido desde este menú, así que
 * se agrega acá nomás.
 */
const opcionesEstadoCita: { value: EstadoCita | "cancelada"; label: string }[] = [
  ...estados,
  { value: "cancelada", label: "Cancelada" },
];

/**
 * Confirmar una cita es acción exclusiva del profesional asignado a ella,
 * o de owner/admin en su nombre (decisión de Walter: se permite para no
 * trabar la agenda si el dentista no usa el sistema). El resto de roles de
 * agenda (reception, assistant) puede ver y mover otros estados, pero no
 * este — ver migración 20260901130000_appointment_dentist_confirmation.
 */
function puedeConfirmarCita(access: ClinicAccess, professionalId: string): boolean {
  if (access.role === "owner" || access.role === "admin") return true;
  return Boolean(access.myProfessionalId) && access.myProfessionalId === professionalId;
}

function claseEstadoBadge(estado: EstadoCita) {
  return cn(
    "w-fit rounded px-1.5 py-0.5 text-[10px] font-medium",
    estado === "ausente"
      ? "bg-destructive/10 text-destructive"
      : estado === "en-sala"
        ? "bg-warning-soft text-warning"
        : estado === "tentativa"
          ? "bg-ai-soft text-ai"
          : estado === "finalizada"
            ? "bg-secondary text-muted-foreground"
            : "bg-brand-soft text-brand",
  );
}

/**
 * Cambia el estado de una cita sin salir de la agenda — hoy es la acción más
 * repetida del día de una recepcionista (confirmar, marcar en sala,
 * finalizar, ausente, cancelar) y hasta esta pantalla no había ningún camino
 * de UI hasta `setAppointmentStatus`, solo el flujo offline lo llamaba.
 *
 * Vive dentro de un `<Link>` que navega a la ficha del paciente (mismo
 * patrón resuelto para `WhatsAppButton` más abajo): el wrapper con
 * `onClick={preventDefault}` + `onMouseDown={stopPropagation}` intercepta el
 * click antes de que llegue al `<a>` del Link, incluyendo los clicks que
 * originan en el contenido del dropdown (portal de Radix) — React hace
 * bubbling de eventos de portales por el árbol de componentes, no por el
 * DOM físico, así que el wrapper los agarra igual.
 */
/**
 * Situación financiera del paciente en la fila de la agenda (G-3).
 *
 * Tres estados y no dos: "sin datos" (el paciente no tiene ningún plan
 * facturado todavía) es distinto de "al día" (tiene planes y no debe nada), y
 * confundirlos haría que un paciente nuevo se vea igual que uno que ya pagó
 * todo. Regla 11 del CLAUDE.md: placeholder nullable, nunca fabricar el cero.
 */
function SaldoBadge({
  saldoCents,
  currency,
}: {
  saldoCents: number | undefined;
  currency: string;
}) {
  if (saldoCents === undefined) {
    return <span className="text-[11px] text-muted-foreground">Sin datos</span>;
  }
  if (saldoCents > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
        Debe {formatMoney(saldoCents, currency)}
      </span>
    );
  }
  if (saldoCents < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-ai-soft px-1.5 py-0.5 text-[11px] font-medium text-ai">
        A favor {formatMoney(-saldoCents, currency)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success">
      Al día
    </span>
  );
}

function CambiarEstadoMenu({
  clinicId,
  userId,
  appointmentId,
  estadoActual,
  puedeConfirmar,
}: {
  clinicId: string;
  userId: string;
  appointmentId: string;
  estadoActual: EstadoCita;
  /** Confirmar una cita está reservado al profesional asignado a ella (o
   * admin/owner en su nombre) — ver migración
   * 20260901130000_appointment_dentist_confirmation. El resto de estados
   * (en-sala, ausente, finalizada, cancelada) sigue abierto a cualquier rol
   * de agenda, esa restricción no cambia. */
  puedeConfirmar: boolean;
}) {
  const setEstadoFn = useServerFn(setAppointmentStatus);

  const cambiar = useOfflineMutation({
    kind: "cambiar-estado-cita",
    userId,
    ejecutar: (payload) => setEstadoFn({ data: payload }),
    invalidar: [["appointments", clinicId]],
    resumen: (p) => `Cita → ${String(p.estado)}`,
    // Coalesce: si cambian el estado de la misma cita varias veces sin
    // conexión, solo importa el último valor, no acumular una entrada por click.
    identidad: (p) => String(p.appointmentId),
  });

  return (
    <span onClick={(e) => e.preventDefault()} onMouseDown={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={cambiar.enCurso}
            className={cn(
              "inline-flex items-center gap-0.5 transition-opacity hover:opacity-80 disabled:opacity-50",
              claseEstadoBadge(estadoActual),
            )}
          >
            {cambiar.enCurso ? (
              <Loader2 className="size-2.5 animate-spin" />
            ) : (
              etiquetaEstado[estadoActual]
            )}
            <ChevronDown className="size-2.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {opcionesEstadoCita
            .filter((o) => o.value !== estadoActual)
            .filter((o) => o.value !== "confirmada" || puedeConfirmar)
            .map((o) => (
              <DropdownMenuItem
                key={o.value}
                onSelect={() => cambiar.mutar({ appointmentId, estado: o.value })}
              >
                {o.label}
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

function NuevaCitaDialog({
  clinicId,
  userId,
  country,
  sucursales,
  profesionales,
  pacientes,
  allergyAlerts,
}: {
  clinicId: string;
  userId: string;
  country: string | undefined;
  sucursales: { id: string; nombre: string }[];
  profesionales: { id: string; nombre: string; sucursalId: string | null }[];
  pacientes: { id: string; nombre: string }[];
  /** patientId -> alergias, ver listAllergyAlerts. Ausente/vacío = sin
   * aviso (RLS restringe a owner/admin/dentist/assistant, o el rol no
   * tiene clinical:view — ver agenda.tsx). */
  allergyAlerts?: Record<string, string[]>;
}) {
  const [open, setOpen] = useState(false);
  const [pacienteId, setPacienteId] = useState("");
  const [sucursalId, setSucursalId] = useState("");
  const [profesionalId, setProfesionalId] = useState("");
  const [tratamiento, setTratamiento] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [duracion, setDuracion] = useState(30);

  const createFn = useServerFn(createAppointment);
  const fetchProcedures = useServerFn(listProcedures);
  const proceduresQuery = useQuery({
    queryKey: ["procedures", clinicId],
    queryFn: () => fetchProcedures({ data: { clinicId } }),
  });
  const procedimientoSeleccionado = proceduresQuery.data?.find(
    (p) => p.name.trim().toLowerCase() === tratamiento.trim().toLowerCase(),
  );

  // Feriados (Nager.Date) del país de la clínica, para avisarle al staff si
  // agendó sobre un feriado (no bloquea: la clínica puede igual atender).
  const startsYear = startsAt ? Number(startsAt.slice(0, 4)) : new Date().getFullYear();
  const { holidaysByDate } = usePublicHolidays(country, [startsYear]);
  const feriadoSeleccionado = startsAt ? (holidaysByDate.get(startsAt.slice(0, 10)) ?? null) : null;

  const disponibles = profesionales.filter((p) => !sucursalId || p.sucursalId === sucursalId);

  const crear = useOfflineMutation({
    kind: "crear-cita",
    userId,
    ejecutar: (payload) => createFn({ data: payload }),
    invalidar: [["appointments", clinicId]],
    resumen: (p) => `Cita: ${String(p.tratamiento)}`,
    // Aviso SOLAPADO, no bloqueo (ver appointments.functions.ts): el server
    // igual creó la cita, esto solo le avisa a quien agenda que otra cita
    // del mismo profesional ya ocupa (parte de) ese horario, por si fue un
    // error y prefiere reagendar a mano.
    onExito: (resultado) => avisarSiSolapa(resultado),
    onDone: () => {
      setOpen(false);
      setPacienteId("");
      setSucursalId("");
      setProfesionalId("");
      setTratamiento("");
      setStartsAt("");
      setDuracion(30);
    },
  });

  function agendar() {
    void crear.mutar({
      // Igual que en los cobros: el id sale del equipo para que reintentar
      // la cola no agende la misma cita dos veces.
      id: crypto.randomUUID(),
      clinicId,
      branchId: sucursalId,
      patientId: pacienteId,
      professionalId: profesionalId,
      tratamiento: tratamiento.trim(),
      procedureId: procedimientoSeleccionado?.id,
      // `startsAt` viaja como wall-clock crudo y el servidor lo interpreta en
      // la timezone de la sucursal. Es determinista: da igual si esto se
      // sincroniza dentro de tres días, la hora agendada no se corre.
      startsAt,
      duracionMin: duracion,
    });
  }

  const puedeCrear = pacienteId && sucursalId && profesionalId && tratamiento.trim() && startsAt;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Nueva cita
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva cita</DialogTitle>
          <DialogDescription>
            La hora se interpreta en el huso horario de la sucursal seleccionada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nc-paciente">Paciente</Label>
            <PatientCombobox
              id="nc-paciente"
              value={pacienteId}
              onChange={setPacienteId}
              pacientes={pacientes}
            />
            {pacienteId && <AllergyAlertBanner allergies={allergyAlerts?.[pacienteId] ?? []} />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-sucursal">Sucursal</Label>
              <select
                id="nc-sucursal"
                value={sucursalId}
                onChange={(e) => {
                  setSucursalId(e.target.value);
                  setProfesionalId("");
                }}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              >
                <option value="">Elegir sucursal…</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-profesional">Profesional</Label>
              <select
                id="nc-profesional"
                value={profesionalId}
                onChange={(e) => setProfesionalId(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              >
                <option value="">Elegir profesional…</option>
                {disponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-tratamiento">Tratamiento / motivo</Label>
            <input
              id="nc-tratamiento"
              value={tratamiento}
              onChange={(e) => setTratamiento(e.target.value)}
              placeholder="Ej: Control, limpieza…"
              list="nc-procedimientos"
              className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
            <datalist id="nc-procedimientos">
              {(proceduresQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            {procedimientoSeleccionado && (
              <p className="text-[11px] text-muted-foreground">
                Ligado al procedimiento del catálogo — se reflejará en presupuestos futuros.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-inicio">Fecha y hora</Label>
              <input
                id="nc-inicio"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-duracion">Duración (min)</Label>
              <input
                id="nc-duracion"
                type="number"
                min={5}
                max={480}
                step={5}
                value={duracion}
                onChange={(e) => setDuracion(Number(e.target.value))}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              />
            </div>
          </div>
          {feriadoSeleccionado && <HolidayNotice name={feriadoSeleccionado} />}
        </div>
        <DialogFooter>
          <Button onClick={agendar} disabled={crear.enCurso || !puedeCrear}>
            {crear.enCurso && <Loader2 className="size-3.5 animate-spin" />}
            Agendar cita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Reprograma una cita existente en el mismo diálogo de "Nueva cita" pero
 * precargado — antes la única forma de mover una cita era cancelarla y
 * volver a agendar desde cero, perdiendo el historial de WhatsApp ligado a
 * ese `appointmentId` (auditoría UX, 30-ago).
 */
function EditarCitaDialog({
  clinicId,
  userId,
  country,
  cita,
  sucursales,
  profesionales,
  pacientes,
}: {
  clinicId: string;
  userId: string;
  country: string | undefined;
  cita: Cita;
  sucursales: { id: string; nombre: string }[];
  profesionales: { id: string; nombre: string; sucursalId: string | null }[];
  pacientes: { id: string; nombre: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [sucursalId, setSucursalId] = useState(cita.sucursalId);
  const [profesionalId, setProfesionalId] = useState(cita.profesionalId);
  const [tratamiento, setTratamiento] = useState(cita.tratamiento);
  const [startsAt, setStartsAt] = useState(`${cita.fecha}T${horaDeCita(cita.inicio)}`);
  const [duracion, setDuracion] = useState(cita.duracion);

  function reabrirConValoresActuales(next: boolean) {
    if (next) {
      setSucursalId(cita.sucursalId);
      setProfesionalId(cita.profesionalId);
      setTratamiento(cita.tratamiento);
      setStartsAt(`${cita.fecha}T${horaDeCita(cita.inicio)}`);
      setDuracion(cita.duracion);
    }
    setOpen(next);
  }

  const updateFn = useServerFn(updateAppointment);
  const fetchProcedures = useServerFn(listProcedures);
  const proceduresQuery = useQuery({
    queryKey: ["procedures", clinicId],
    queryFn: () => fetchProcedures({ data: { clinicId } }),
    enabled: open,
  });
  const procedimientoSeleccionado = proceduresQuery.data?.find(
    (p) => p.name.trim().toLowerCase() === tratamiento.trim().toLowerCase(),
  );

  const startsYear = startsAt ? Number(startsAt.slice(0, 4)) : new Date().getFullYear();
  const { holidaysByDate } = usePublicHolidays(country, [startsYear]);
  const feriadoSeleccionado = startsAt ? (holidaysByDate.get(startsAt.slice(0, 10)) ?? null) : null;

  const disponibles = profesionales.filter((p) => !sucursalId || p.sucursalId === sucursalId);

  const editar = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          appointmentId: cita.id,
          clinicId,
          branchId: sucursalId,
          professionalId: profesionalId,
          tratamiento: tratamiento.trim(),
          procedureId: procedimientoSeleccionado?.id,
          startsAt,
          duracionMin: duracion,
        },
      }),
    onSuccess: (resultado) => {
      avisarSiSolapa(resultado);
      toast.success("Cita actualizada.");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const puedeGuardar = sucursalId && profesionalId && tratamiento.trim() && startsAt;

  return (
    <Dialog open={open} onOpenChange={reabrirConValoresActuales}>
      <DialogTrigger asChild>
        <button
          type="button"
          title="Editar cita"
          aria-label="Editar cita"
          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-ink"
        >
          <Pencil className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cita</DialogTitle>
          <DialogDescription>
            {cita.paciente} · la hora se interpreta en el huso horario de la sucursal seleccionada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ec-sucursal">Sucursal</Label>
              <select
                id="ec-sucursal"
                value={sucursalId}
                onChange={(e) => {
                  setSucursalId(e.target.value);
                  setProfesionalId("");
                }}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              >
                <option value="">Elegir sucursal…</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec-profesional">Profesional</Label>
              <select
                id="ec-profesional"
                value={profesionalId}
                onChange={(e) => setProfesionalId(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              >
                <option value="">Elegir profesional…</option>
                {disponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec-tratamiento">Tratamiento / motivo</Label>
            <input
              id="ec-tratamiento"
              value={tratamiento}
              onChange={(e) => setTratamiento(e.target.value)}
              placeholder="Ej: Control, limpieza…"
              list="ec-procedimientos"
              className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
            <datalist id="ec-procedimientos">
              {(proceduresQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ec-inicio">Fecha y hora</Label>
              <input
                id="ec-inicio"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec-duracion">Duración (min)</Label>
              <input
                id="ec-duracion"
                type="number"
                min={5}
                max={480}
                step={5}
                value={duracion}
                onChange={(e) => setDuracion(Number(e.target.value))}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              />
            </div>
          </div>
          {feriadoSeleccionado && <HolidayNotice name={feriadoSeleccionado} />}
        </div>
        <DialogFooter>
          <Button onClick={() => editar.mutate()} disabled={editar.isPending || !puedeGuardar}>
            {editar.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgendarSolicitudDialog({
  clinicId,
  country,
  sucursales,
  profesionales,
  request,
  open,
  onOpenChange,
}: {
  clinicId: string;
  country: string | undefined;
  sucursales: { id: string; nombre: string }[];
  profesionales: { id: string; nombre: string; sucursalId: string | null }[];
  request: PendingAppointmentRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [sucursalId, setSucursalId] = useState("");
  const [profesionalId, setProfesionalId] = useState("");
  const [duracion, setDuracion] = useState(30);
  const [startsAt, setStartsAt] = useState(`${request.preferredDate}T09:00`);

  const queryClient = useQueryClient();
  const createFn = useServerFn(createAppointment);
  const markScheduledFn = useServerFn(markAppointmentRequestScheduled);

  // Feriados (Nager.Date) del país de la clínica — el paciente pidió esta
  // fecha desde el portal sin saber si es feriado; se lo marcamos al staff
  // acá, en el momento de confirmar la hora real.
  const startsYear = startsAt ? Number(startsAt.slice(0, 4)) : new Date().getFullYear();
  const { holidaysByDate } = usePublicHolidays(country, [startsYear]);
  const feriadoSeleccionado = startsAt ? (holidaysByDate.get(startsAt.slice(0, 10)) ?? null) : null;

  const disponibles = profesionales.filter((p) => !sucursalId || p.sucursalId === sucursalId);

  const agendar = useMutation({
    mutationFn: async () => {
      const { id, solapamiento } = await createFn({
        data: {
          clinicId,
          branchId: sucursalId,
          patientId: request.patientId,
          professionalId: profesionalId,
          tratamiento: request.reason.slice(0, 200),
          startsAt,
          duracionMin: duracion,
        },
      });
      await markScheduledFn({ data: { clinicId, requestId: request.id, appointmentId: id } });
      return { solapamiento };
    },
    onSuccess: ({ solapamiento }) => {
      queryClient.invalidateQueries({ queryKey: ["appointments", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["appointment-requests", clinicId] });
      toast.success("Cita agendada y solicitud cerrada");
      // Aviso SOLAPADO, no bloqueo — ver appointments.functions.ts.
      avisarSiSolapa({ solapamiento });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const puedeAgendar = sucursalId && profesionalId && startsAt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agendar solicitud de {request.patientName}</DialogTitle>
          <DialogDescription>{request.reason}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="as-sucursal">Sucursal</Label>
              <select
                id="as-sucursal"
                value={sucursalId}
                onChange={(e) => {
                  setSucursalId(e.target.value);
                  setProfesionalId("");
                }}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              >
                <option value="">Elegir sucursal…</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-profesional">Profesional</Label>
              <select
                id="as-profesional"
                value={profesionalId}
                onChange={(e) => setProfesionalId(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              >
                <option value="">Elegir profesional…</option>
                {disponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="as-inicio">Fecha y hora</Label>
              <input
                id="as-inicio"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-duracion">Duración (min)</Label>
              <input
                id="as-duracion"
                type="number"
                min={5}
                max={480}
                step={5}
                value={duracion}
                onChange={(e) => setDuracion(Number(e.target.value))}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              />
            </div>
          </div>
          {feriadoSeleccionado && <HolidayNotice name={feriadoSeleccionado} />}
        </div>
        <DialogFooter>
          <Button onClick={() => agendar.mutate()} disabled={agendar.isPending || !puedeAgendar}>
            {agendar.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Confirmar cita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Agrega a la lista de espera. El paciente es opcional en el server (puedes
 * anotar a alguien sin ficha todavía), pero acá lo pedimos siempre — sin
 * paciente vinculado no hay teléfono, y entonces la fila nunca va a poder
 * recibir el aviso de "Avisar" por WhatsApp cuando se libera un turno.
 */
function AgregarListaEsperaDialog({
  clinicId,
  pacientes,
}: {
  clinicId: string;
  pacientes: { id: string; nombre: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pacienteId, setPacienteId] = useState("");
  const [motivo, setMotivo] = useState("");

  const queryClient = useQueryClient();
  const createFn = useServerFn(createWaitlistEntry);

  const crear = useMutation({
    mutationFn: () =>
      createFn({ data: { clinicId, patientId: pacienteId, reason: motivo.trim() || undefined } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist", clinicId] });
      toast.success("Agregado a la lista de espera");
      setOpen(false);
      setPacienteId("");
      setMotivo("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-3.5" /> Agregar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar a lista de espera</DialogTitle>
          <DialogDescription>
            Cuando se libere un turno, vas a poder avisarle por WhatsApp con un click.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="le-paciente">Paciente</Label>
            <PatientCombobox
              id="le-paciente"
              value={pacienteId}
              onChange={setPacienteId}
              pacientes={pacientes}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="le-motivo">Motivo (opcional)</Label>
            <input
              id="le-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Control, limpieza…"
              className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => crear.mutate()} disabled={crear.isPending || !pacienteId}>
            {crear.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgendaPage() {
  const { access } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const clinicId = access.clinic?.id;
  const hoy = hoyISO(access.clinic?.timezone);

  const fetchAppointments = useServerFn(listAppointments);
  const fetchBranches = useServerFn(listBranches);
  const fetchProfessionals = useServerFn(listProfessionals);
  const fetchPatients = useServerFn(listPatients);
  const fetchWaitlist = useServerFn(listWaitlist);
  const fetchAllergyAlerts = useServerFn(listAllergyAlerts);
  const fetchBalances = useServerFn(getAppointmentPatientBalances);

  const { data: appointmentsRes, isLoading } = useQuery({
    queryKey: ["appointments", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchAppointments({ data: { clinicId: clinicId! } }),
  });
  const citas = useMemo(() => appointmentsRes?.items ?? [], [appointmentsRes]);

  // Reemplaza la tarjeta "Optimización IA" (siempre vacía, "Próximamente" —
  // auditoría de UI, 30-ago) por un dato real: citas de las próximas 48h que
  // nadie confirmó todavía. Mismo criterio que el dashboard.
  const sinConfirmar48h = useMemo(() => {
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + 2);
    const limiteISO = limite.toISOString().slice(0, 10);
    return citas.filter((c) => c.fecha >= hoy && c.fecha <= limiteISO && c.estado === "tentativa");
  }, [citas, hoy]);
  // producto-1/ux-1: alergias por paciente para toda la clínica en 1 query
  // (no una por cita — ver listAllergyAlerts). Mismo gate que la ficha del
  // paciente (clinical:view): reception/accounting no ven este aviso, es
  // la misma restricción de RLS que ya rige patient_medical_history
  // (migración 20260826180000), no algo nuevo introducido acá.
  const { data: allergyAlerts = {} } = useQuery({
    queryKey: ["allergy-alerts", clinicId],
    enabled: Boolean(clinicId) && hasPermission(access.role, "clinical:view"),
    queryFn: () => fetchAllergyAlerts({ data: { clinicId: clinicId! } }),
  });

  const { data: sucursales = [] } = useQuery({
    queryKey: ["branches", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchBranches({ data: { clinicId: clinicId! } }),
  });
  const { data: profesionales = [] } = useQuery({
    queryKey: ["professionals", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchProfessionals({ data: { clinicId: clinicId! } }),
  });
  const { data: pacientesRes } = useQuery({
    queryKey: ["patients", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchPatients({ data: { clinicId: clinicId! } }),
  });
  const pacientes = useMemo(() => pacientesRes?.items ?? [], [pacientesRes]);
  const { data: listaEspera = [] } = useQuery({
    queryKey: ["waitlist", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchWaitlist({ data: { clinicId: clinicId! } }),
  });

  const fetchSolicitudes = useServerFn(listPendingAppointmentRequests);
  const declineFn = useServerFn(declineAppointmentRequest);
  const queryClient = useQueryClient();

  const { data: solicitudes = [] } = useQuery({
    queryKey: ["appointment-requests", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchSolicitudes({ data: { clinicId: clinicId! } }),
  });

  const [solicitudEnAgenda, setSolicitudEnAgenda] = useState<PendingAppointmentRequest | null>(
    null,
  );

  const rechazar = useMutation({
    mutationFn: (requestId: string) => declineFn({ data: { clinicId: clinicId!, requestId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-requests", clinicId] });
      toast.success("Solicitud rechazada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeWaitlistFn = useServerFn(removeWaitlistEntry);
  const quitarDeEspera = useMutation({
    mutationFn: (id: string) => removeWaitlistFn({ data: { clinicId: clinicId!, id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist", clinicId] });
      toast.success("Sacado de la lista de espera");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setEstadoFn = useServerFn(setAppointmentStatus);
  const aceptarCita = useMutation({
    mutationFn: (appointmentId: string) =>
      setEstadoFn({ data: { appointmentId, estado: "confirmada" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", clinicId] });
      toast.success("Cita confirmada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (patch: Partial<AgendaSearch>) =>
    navigate({ search: (prev: AgendaSearch) => ({ ...prev, ...patch, page: patch.page ?? 1 }) });

  // Rango de fechas visible según la vista (día = un día; semana = L→D;
  // mes = primer→último del mes). El listado de abajo y las tres vistas
  // comparten este rango, así el conteo y el listado siempre concuerdan.
  const [rangoDesde, rangoHasta] = useMemo(
    () => rangoDeVista(search.vista, search.fecha),
    [search.vista, search.fecha],
  );

  const filtradas = useMemo(
    () =>
      citas.filter((c) => {
        const profesionalNombre = profesionales.find((p) => p.id === c.profesionalId)?.nombre;
        if (!coincide(search.q, c.paciente, c.tratamiento, profesionalNombre)) return false;
        if (c.fecha < rangoDesde || c.fecha > rangoHasta) return false;
        if (search.sucursal && c.sucursalId !== search.sucursal) return false;
        if (search.profesional && c.profesionalId !== search.profesional) return false;
        if (search.estado && c.estado !== search.estado) return false;
        return true;
      }),
    [
      citas,
      profesionales,
      search.q,
      search.sucursal,
      search.profesional,
      search.estado,
      rangoDesde,
      rangoHasta,
    ],
  );

  const columnas = useMemo(
    () =>
      profesionales.filter((p) => {
        if (search.sucursal && p.sucursalId !== search.sucursal) return false;
        if (search.profesional && p.id !== search.profesional) return false;
        return true;
      }),
    [profesionales, search.sucursal, search.profesional],
  );

  const ordenadas = useMemo(
    () => [...filtradas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicio - b.inicio),
    [filtradas],
  );
  const pagina = paginar(ordenadas, search.page);

  // G-3: situación financiera de los pacientes visibles en la página, para que
  // recepción sepa a quién cobrarle antes de que entre al box. Una sola
  // agregación por lote (igual que las alergias), acotada a la página y no a
  // la clínica entera. Gate `finance:view`: un asistente clínico no ve deudas.
  const puedeVerSaldos = hasPermission(access.role, "finance:view");
  const pacienteIdsVisibles = useMemo(
    () => [...new Set(pagina.items.map((c) => c.pacienteId))].sort(),
    [pagina.items],
  );
  const { data: saldos = {} } = useQuery({
    queryKey: ["appointment-balances", clinicId, pacienteIdsVisibles],
    enabled: Boolean(clinicId) && puedeVerSaldos && pacienteIdsVisibles.length > 0,
    queryFn: () =>
      fetchBalances({ data: { clinicId: clinicId!, patientIds: pacienteIdsVisibles } }),
  });
  const activos =
    [search.q, search.sucursal, search.profesional, search.estado].filter(Boolean).length +
    (search.fecha !== hoy ? 1 : 0);

  return (
    <AppShell title="Agenda" access={access}>
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          {clinicId && hasPermission(access.role, "agenda:manage") && (
            <NuevaCitaDialog
              clinicId={clinicId}
              userId={access.userId}
              country={access.clinic?.country}
              sucursales={sucursales}
              profesionales={profesionales}
              pacientes={pacientes}
              allergyAlerts={allergyAlerts}
            />
          )}
        </div>

        {appointmentsRes?.truncated && (
          <p className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-2.5 text-xs text-warning">
            Mostrando las primeras {citas.length.toLocaleString("es")} citas. Si buscas una cita muy
            antigua o muy futura, puede que no aparezca acá.
          </p>
        )}

        <FilterBar
          activos={activos}
          onReset={() =>
            navigate({
              search: {
                q: "",
                fecha: hoy,
                vista: search.vista,
                sucursal: "",
                profesional: "",
                estado: "",
                page: 1,
              },
            })
          }
        >
          <SearchField
            label="Buscar"
            value={search.q}
            onChange={(q) => set({ q })}
            placeholder="Paciente, tratamiento…"
          />
          <DateField label="Fecha" value={search.fecha} onChange={(fecha) => set({ fecha })} />
          <SelectField
            label="Sucursal"
            value={search.sucursal}
            onChange={(sucursal) => set({ sucursal, profesional: "" })}
            allLabel="Todas las sucursales"
            options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
          />
          <SelectField
            label="Profesional"
            value={search.profesional}
            onChange={(profesional) => set({ profesional })}
            allLabel="Todos los profesionales"
            options={profesionales
              .filter((p) => !search.sucursal || p.sucursalId === search.sucursal)
              .map((p) => ({ value: p.id, label: p.box ? `${p.nombre} · ${p.box}` : p.nombre }))}
          />
          <SelectField
            label="Estado"
            value={search.estado}
            onChange={(estado) => set({ estado })}
            allLabel="Todos los estados"
            options={estados}
          />
        </FilterBar>

        <div className="grid gap-8 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-9">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Período anterior"
                  onClick={() => set({ fecha: desplazarPeriodo(search.vista, search.fecha, -1) })}
                  className="grid size-8 place-items-center rounded-lg border border-hairline hover:bg-secondary/60"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => set({ fecha: hoy })}
                  className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium hover:bg-secondary/60"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  aria-label="Período siguiente"
                  onClick={() => set({ fecha: desplazarPeriodo(search.vista, search.fecha, 1) })}
                  className="grid size-8 place-items-center rounded-lg border border-hairline hover:bg-secondary/60"
                >
                  <ChevronRight className="size-4" />
                </button>
                <h2 className="ml-1 font-display text-lg font-semibold capitalize">
                  {labelPeriodo(search.vista, search.fecha)}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex rounded-lg border border-hairline p-0.5 text-xs">
                  {(["dia", "semana", "mes"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set({ vista: v })}
                      className={cn(
                        "rounded-md px-2.5 py-1 font-medium capitalize",
                        search.vista === v
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {v === "dia" ? "Día" : v}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isLoading
                    ? "Cargando…"
                    : `${filtradas.length} cita${filtradas.length === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>

            {search.vista === "dia" && (
              <AgendaGrid
                citas={filtradas}
                profesionales={columnas}
                allergyAlerts={allergyAlerts}
              />
            )}
            {search.vista === "semana" && (
              <AgendaWeek
                citas={filtradas}
                fecha={search.fecha}
                hoy={hoy}
                profesionales={profesionales}
              />
            )}
            {search.vista === "mes" && (
              <AgendaMonth
                citas={filtradas}
                fecha={search.fecha}
                hoy={hoy}
                onSelectDay={(dia) => set({ fecha: dia, vista: "dia" })}
                profesionales={profesionales}
              />
            )}

            <div className="card-clinical overflow-hidden">
              <div className="border-b border-hairline bg-secondary/40 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Listado de citas filtradas
              </div>
              <div className="divide-y divide-hairline">
                {pagina.items.map((c) => {
                  const profesionalNombre =
                    profesionales.find((p) => p.id === c.profesionalId)?.nombre ?? "—";
                  const sucursalNombre =
                    sucursales.find((s) => s.id === c.sucursalId)?.nombre ?? "—";
                  return (
                    <Link
                      key={c.id}
                      to="/pacientes/$pacienteId"
                      params={{ pacienteId: c.pacienteId }}
                      className="grid gap-2 px-5 py-3 transition-colors hover:bg-secondary/50 sm:grid-cols-[auto_2fr_1.5fr_1fr_auto_auto] sm:items-center sm:gap-4"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {horaDeCita(c.inicio)}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 truncate text-sm font-medium">
                          <span className="truncate">{c.paciente}</span>
                          <AllergyAlertIcon allergies={allergyAlerts[c.pacienteId]} />
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{c.tratamiento}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {profesionalNombre} · {sucursalNombre}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {c.duracion} min
                        {puedeVerSaldos && (
                          <SaldoBadge
                            saldoCents={saldos[c.pacienteId]}
                            currency={access.clinic?.currency ?? "CLP"}
                          />
                        )}
                      </span>
                      {clinicId && hasPermission(access.role, "agenda:manage") ? (
                        <span className="flex items-center gap-1">
                          <CambiarEstadoMenu
                            clinicId={clinicId}
                            userId={access.userId}
                            appointmentId={c.id}
                            estadoActual={c.estado}
                            puedeConfirmar={puedeConfirmarCita(access, c.profesionalId)}
                          />
                          <span
                            onClick={(e) => e.preventDefault()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <EditarCitaDialog
                              clinicId={clinicId}
                              userId={access.userId}
                              country={access.clinic?.country}
                              cita={c}
                              sucursales={sucursales}
                              profesionales={profesionales}
                              pacientes={pacientes}
                            />
                          </span>
                        </span>
                      ) : (
                        <span className={claseEstadoBadge(c.estado)}>
                          {etiquetaEstado[c.estado]}
                        </span>
                      )}
                      {clinicId && access.clinic?.name && (
                        <span
                          onClick={(e) => e.preventDefault()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <WhatsAppButton
                            clinicId={clinicId}
                            patientId={c.pacienteId}
                            appointmentId={c.id}
                            templateKind="appointment_reminder"
                            variables={{
                              tratamiento: c.tratamiento,
                              fecha_larga: formatoFechaLarga(c.fecha),
                              hora: horaDeCita(c.inicio),
                              profesional: profesionalNombre,
                              clinica: access.clinic.name,
                            }}
                          />
                        </span>
                      )}
                    </Link>
                  );
                })}
                {!isLoading && pagina.items.length === 0 && (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No hay citas que coincidan con los filtros aplicados.
                  </p>
                )}
              </div>
              <Paginacion
                pagina={pagina}
                etiqueta="citas"
                onPage={(page) => navigate({ search: (p: AgendaSearch) => ({ ...p, page }) })}
              />
            </div>
          </div>

          <aside className="space-y-4 xl:col-span-3">
            {solicitudes.length > 0 && (
              <>
                <h2 className="flex items-center gap-1.5 font-display text-xl font-semibold text-muted-foreground">
                  <Inbox className="size-4" /> Solicitudes del portal
                  <span className="ml-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
                    {solicitudes.length}
                  </span>
                </h2>
                <div className="card-clinical divide-y divide-hairline">
                  {solicitudes.map((s) => (
                    <div key={s.id} className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{s.patientName}</p>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                            s.priority === "alta"
                              ? "bg-destructive/10 text-destructive"
                              : s.priority === "media"
                                ? "bg-warning-soft text-warning"
                                : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {s.priority}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{s.reason}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Prefiere: {formatoFechaLarga(s.preferredDate)}
                      </p>
                      {clinicId && hasPermission(access.role, "agenda:manage") && (
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSolicitudEnAgenda(s)}
                          >
                            Agendar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            disabled={rechazar.isPending}
                            onClick={() => rechazar.mutate(s.id)}
                          >
                            <X className="size-3.5" /> Rechazar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold text-muted-foreground">
                Lista de espera
              </h2>
              {clinicId && hasPermission(access.role, "agenda:manage") && (
                <AgregarListaEsperaDialog clinicId={clinicId} pacientes={pacientes} />
              )}
            </div>
            <div className="card-clinical divide-y divide-hairline">
              {listaEspera.length === 0 && (
                <p className="p-4 text-xs text-muted-foreground">
                  Sin pacientes en lista de espera por ahora.
                </p>
              )}
              {listaEspera.map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-warning" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{e.nombre}</p>
                      <p className="text-xs text-muted-foreground">{e.motivo}</p>
                      {e.espera !== "—" && (
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="size-3" /> {e.espera} de espera
                        </p>
                      )}
                      {!e.patientPhone && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Sin paciente vinculado — no se le puede avisar por WhatsApp.
                        </p>
                      )}
                    </div>
                  </div>
                  {clinicId && hasPermission(access.role, "agenda:manage") && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      {e.patientId && access.clinic?.name && (
                        <WhatsAppButton
                          clinicId={clinicId}
                          patientId={e.patientId}
                          templateKind="waitlist_opening"
                          label="Avisar"
                          variables={{ motivo: e.motivo, clinica: access.clinic.name }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => quitarDeEspera.mutate(e.id)}
                        disabled={quitarDeEspera.isPending}
                        title="Quitar de la lista"
                        aria-label="Quitar de la lista"
                        className="inline-flex size-7 items-center justify-center rounded-md border border-hairline text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-warning/20 bg-warning-soft p-5">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-warning">
                <CircleAlert className="size-3" /> Sin confirmar (48h)
              </p>
              {sinConfirmar48h.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Todo confirmado en las próximas 48h.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    {sinConfirmar48h.length} cita{sinConfirmar48h.length === 1 ? "" : "s"} sin
                    confirmar todavía:
                  </p>
                  <ul className="space-y-1.5">
                    {sinConfirmar48h.slice(0, 4).map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium">
                          {c.paciente} · {formatoFechaLarga(c.fecha)} {horaDeCita(c.inicio)}
                        </span>
                        {puedeConfirmarCita(access, c.profesionalId) && (
                          <button
                            type="button"
                            onClick={() => aceptarCita.mutate(c.id)}
                            disabled={aceptarCita.isPending}
                            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-brand transition-colors hover:bg-brand-soft disabled:opacity-50"
                          >
                            Aceptar
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {clinicId && solicitudEnAgenda && (
        <AgendarSolicitudDialog
          clinicId={clinicId}
          country={access.clinic?.country}
          sucursales={sucursales}
          profesionales={profesionales}
          request={solicitudEnAgenda}
          open={Boolean(solicitudEnAgenda)}
          onOpenChange={(open) => !open && setSolicitudEnAgenda(null)}
        />
      )}
    </AppShell>
  );
}
