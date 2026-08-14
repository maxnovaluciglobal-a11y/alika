import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { DateField, FilterBar, Paginacion, SearchField, SelectField } from "@/components/filters";
import { AgendaGrid } from "@/components/agenda-grid";
import { Button } from "@/components/ui/button";
import { WhatsAppButton } from "@/components/whatsapp-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { requirePermission } from "@/lib/route-guards";
import { hasPermission } from "@/lib/access";
import {
  etiquetaEstado,
  formatoFechaLarga,
  HORA_INICIO,
  hoyISO,
  type EstadoCita,
} from "@/lib/clinic-data";

// Fallback para el default de validateSearch (no tiene acceso al contexto
// de la ruta ni a la clínica activa). Dentro del componente usamos la
// timezone real de la clínica vía access.clinic?.timezone.
const HOY = hoyISO();
import { listBranches, listProfessionals } from "@/lib/clinic-catalog.functions";
import { listPatients } from "@/lib/patients.functions";
import { createAppointment, listAppointments } from "@/lib/appointments.functions";
import { listWaitlist } from "@/lib/waitlist.functions";
import { coincide, num, paginar, str } from "@/lib/search";
import { cn } from "@/lib/utils";

interface AgendaSearch {
  q: string;
  fecha: string;
  sucursal: string;
  profesional: string;
  estado: string;
  page: number;
}

export const Route = createFileRoute("/_authenticated/_clinic/agenda")({
  validateSearch: (search: Record<string, unknown>): AgendaSearch => ({
    q: str(search.q),
    fecha: str(search.fecha, HOY),
    sucursal: str(search.sucursal),
    profesional: str(search.profesional),
    estado: str(search.estado),
    page: num(search.page, 1),
  }),
  beforeLoad: requirePermission("agenda:view"),
  head: () => ({
    meta: [
      { title: "Agenda inteligente | Oralia" },
      {
        name: "description",
        content:
          "Agenda por fecha, profesional, sucursal y estado, con lista de espera inteligente y predicción de ausencias.",
      },
      { property: "og:title", content: "Agenda inteligente | Oralia" },
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

function NuevaCitaDialog({
  clinicId,
  sucursales,
  profesionales,
  pacientes,
}: {
  clinicId: string;
  sucursales: { id: string; nombre: string }[];
  profesionales: { id: string; nombre: string; sucursalId: string | null }[];
  pacientes: { id: string; nombre: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pacienteId, setPacienteId] = useState("");
  const [sucursalId, setSucursalId] = useState("");
  const [profesionalId, setProfesionalId] = useState("");
  const [tratamiento, setTratamiento] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [duracion, setDuracion] = useState(30);

  const queryClient = useQueryClient();
  const createFn = useServerFn(createAppointment);

  const disponibles = profesionales.filter((p) => !sucursalId || p.sucursalId === sucursalId);

  const crear = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          clinicId,
          branchId: sucursalId,
          patientId: pacienteId,
          professionalId: profesionalId,
          tratamiento: tratamiento.trim(),
          startsAt,
          duracionMin: duracion,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", clinicId] });
      toast.success("Cita agendada");
      setOpen(false);
      setPacienteId("");
      setSucursalId("");
      setProfesionalId("");
      setTratamiento("");
      setStartsAt("");
      setDuracion(30);
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
            La hora se interpreta en el huso horario del servidor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nc-paciente">Paciente</Label>
            <select
              id="nc-paciente"
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
            >
              <option value="">Elegir paciente…</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
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
              className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
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
        </div>
        <DialogFooter>
          <Button onClick={() => crear.mutate()} disabled={crear.isPending || !puedeCrear}>
            {crear.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Agendar cita
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

  const { data: citas = [], isLoading } = useQuery({
    queryKey: ["appointments", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchAppointments({ data: { clinicId: clinicId! } }),
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
  const { data: pacientes = [] } = useQuery({
    queryKey: ["patients", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchPatients({ data: { clinicId: clinicId! } }),
  });
  const { data: listaEspera = [] } = useQuery({
    queryKey: ["waitlist", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchWaitlist({ data: { clinicId: clinicId! } }),
  });

  const set = (patch: Partial<AgendaSearch>) =>
    navigate({ search: (prev: AgendaSearch) => ({ ...prev, ...patch, page: patch.page ?? 1 }) });

  const filtradas = useMemo(
    () =>
      citas.filter((c) => {
        const profesionalNombre = profesionales.find((p) => p.id === c.profesionalId)?.nombre;
        if (!coincide(search.q, c.paciente, c.tratamiento, profesionalNombre)) return false;
        if (search.fecha && c.fecha !== search.fecha) return false;
        if (search.sucursal && c.sucursalId !== search.sucursal) return false;
        if (search.profesional && c.profesionalId !== search.profesional) return false;
        if (search.estado && c.estado !== search.estado) return false;
        return true;
      }),
    [citas, profesionales, search],
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
              sucursales={sucursales}
              profesionales={profesionales}
              pacientes={pacientes}
            />
          )}
        </div>

        <FilterBar
          activos={activos}
          onReset={() =>
            navigate({
              search: { q: "", fecha: hoy, sucursal: "", profesional: "", estado: "", page: 1 },
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
              <h2 className="font-display text-xl font-semibold capitalize">
                {search.fecha ? formatoFechaLarga(search.fecha) : "Todas las fechas"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isLoading
                  ? "Cargando…"
                  : `${filtradas.length} cita${filtradas.length === 1 ? "" : "s"} en la vista`}
              </p>
            </div>

            <AgendaGrid citas={filtradas} profesionales={columnas} />

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
                        <p className="truncate text-sm font-medium">{c.paciente}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.tratamiento}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {profesionalNombre} · {sucursalNombre}
                      </span>
                      <span className="text-xs text-muted-foreground">{c.duracion} min</span>
                      <span
                        className={cn(
                          "w-fit rounded px-1.5 py-0.5 text-[10px] font-medium",
                          c.estado === "ausente"
                            ? "bg-destructive/10 text-destructive"
                            : c.estado === "en-sala"
                              ? "bg-warning-soft text-warning"
                              : c.estado === "tentativa"
                                ? "bg-ai-soft text-ai"
                                : c.estado === "finalizada"
                                  ? "bg-secondary text-muted-foreground"
                                  : "bg-brand-soft text-brand",
                        )}
                      >
                        {etiquetaEstado[c.estado]}
                      </span>
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
            <h2 className="font-display text-xl font-semibold text-muted-foreground">
              Lista de espera
            </h2>
            <div className="card-clinical divide-y divide-hairline">
              {listaEspera.length === 0 && (
                <p className="p-4 text-xs text-muted-foreground">
                  Sin pacientes en lista de espera por ahora.
                </p>
              )}
              {listaEspera.map((e) => (
                <div key={e.id} className="flex items-start gap-3 p-4">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-warning" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{e.nombre}</p>
                    <p className="text-xs text-muted-foreground">{e.motivo}</p>
                    {e.espera !== "—" && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="size-3" /> {e.espera} de espera
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-ai/15 bg-ai-soft p-5">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ai">
                <Sparkles className="size-3" /> Optimización IA
              </p>
              <p className="text-xs text-muted-foreground">
                Próximamente: predicción de ausencias y sugerencias automáticas de reagendamiento,
                una vez que haya suficiente historial de citas reales.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
