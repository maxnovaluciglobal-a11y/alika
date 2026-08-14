import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { DateField, FilterBar, Paginacion, SearchField, SelectField } from "@/components/filters";
import { Button } from "@/components/ui/button";
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
import { etiquetaEstadoPaciente, formatoMoneda, type EstadoPaciente } from "@/lib/clinic-data";
import { listBranches, listProfessionals } from "@/lib/clinic-catalog.functions";
import { createPatient, listPatients } from "@/lib/patients.functions";
import { coincide, num, paginar, str } from "@/lib/search";
import { cn } from "@/lib/utils";

interface PacientesSearch {
  q: string;
  sucursal: string;
  profesional: string;
  estado: string;
  desde: string;
  hasta: string;
  page: number;
}

export const Route = createFileRoute("/_authenticated/_clinic/pacientes/")({
  validateSearch: (search: Record<string, unknown>): PacientesSearch => ({
    q: str(search.q),
    sucursal: str(search.sucursal),
    profesional: str(search.profesional),
    estado: str(search.estado),
    desde: str(search.desde),
    hasta: str(search.hasta),
    page: num(search.page, 1),
  }),
  beforeLoad: requirePermission("patients:view"),
  head: () => ({
    meta: [
      { title: "Pacientes | Alika" },
      {
        name: "description",
        content:
          "Listado de pacientes con búsqueda global, filtros por sucursal, profesional, estado y rango de fechas, más paginación.",
      },
      { property: "og:title", content: "Pacientes | Alika" },
      {
        property: "og:description",
        content:
          "Búsqueda y filtros avanzados de pacientes con saldo, próximo control y riesgo de ausencia.",
      },
    ],
  }),
  component: PacientesPage,
});

const estados: { value: EstadoPaciente; label: string }[] = (
  ["activo", "nuevo", "inactivo"] as EstadoPaciente[]
).map((e) => ({ value: e, label: etiquetaEstadoPaciente[e] }));

function NuevoPacienteDialog({ clinicId }: { clinicId: string }) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");

  const queryClient = useQueryClient();
  const createFn = useServerFn(createPatient);

  const crear = useMutation({
    mutationFn: () =>
      createFn({
        data: { clinicId, nombre: nombre.trim(), documento, fechaNacimiento, telefono, email },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", clinicId] });
      toast.success("Paciente creado");
      setOpen(false);
      setNombre("");
      setDocumento("");
      setFechaNacimiento("");
      setTelefono("");
      setEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Nuevo paciente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo paciente</DialogTitle>
          <DialogDescription>
            Datos básicos para crear la ficha. Podrás completarla luego.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="np-nombre">Nombre completo</Label>
            <input
              id="np-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              placeholder="Nombre y apellido"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-doc">Documento</Label>
              <input
                id="np-doc"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-nac">Fecha de nacimiento</Label>
              <input
                id="np-nac"
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-tel">Teléfono</Label>
              <input
                id="np-tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-email">Email</Label>
              <input
                id="np-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => crear.mutate()}
            disabled={crear.isPending || !nombre.trim() || !fechaNacimiento}
          >
            {crear.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Crear paciente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PacientesPage() {
  const { access } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const clinicId = access.clinic?.id;

  const fetchPatients = useServerFn(listPatients);
  const fetchBranches = useServerFn(listBranches);
  const fetchProfessionals = useServerFn(listProfessionals);

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ["patients", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchPatients({ data: { clinicId: clinicId! } }),
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

  const set = (patch: Partial<PacientesSearch>) =>
    navigate({ search: (prev: PacientesSearch) => ({ ...prev, ...patch, page: patch.page ?? 1 }) });

  const filtrados = useMemo(
    () =>
      pacientes.filter((p) => {
        if (!coincide(search.q, p.nombre, p.documento, p.email, p.telefono, ...p.etiquetas))
          return false;
        if (search.sucursal && p.sucursalId !== search.sucursal) return false;
        if (search.profesional && p.profesionalId !== search.profesional) return false;
        if (search.estado && p.estado !== search.estado) return false;
        if (search.desde && p.ultimaVisitaISO < search.desde) return false;
        if (search.hasta && p.ultimaVisitaISO > search.hasta) return false;
        return true;
      }),
    [pacientes, search],
  );

  const pagina = paginar(filtrados, search.page);
  const activos = [
    search.q,
    search.sucursal,
    search.profesional,
    search.estado,
    search.desde,
    search.hasta,
  ].filter(Boolean).length;

  return (
    <AppShell title="Pacientes" access={access}>
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          {clinicId && hasPermission(access.role, "patients:manage") && (
            <NuevoPacienteDialog clinicId={clinicId} />
          )}
        </div>

        <FilterBar
          activos={activos}
          onReset={() =>
            navigate({
              search: {
                q: "",
                sucursal: "",
                profesional: "",
                estado: "",
                desde: "",
                hasta: "",
                page: 1,
              },
            })
          }
        >
          <SearchField
            label="Buscar"
            value={search.q}
            onChange={(q) => set({ q })}
            placeholder="Nombre, documento, email…"
          />
          <SelectField
            label="Sucursal"
            value={search.sucursal}
            onChange={(sucursal) => set({ sucursal })}
            allLabel="Todas las sucursales"
            options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
          />
          <SelectField
            label="Profesional"
            value={search.profesional}
            onChange={(profesional) => set({ profesional })}
            allLabel="Todos los profesionales"
            options={profesionales.map((p) => ({ value: p.id, label: p.nombre }))}
          />
          <SelectField
            label="Estado"
            value={search.estado}
            onChange={(estado) => set({ estado })}
            allLabel="Todos los estados"
            options={estados}
          />
          <DateField
            label="Última visita desde"
            value={search.desde}
            onChange={(desde) => set({ desde })}
          />
          <DateField
            label="Última visita hasta"
            value={search.hasta}
            onChange={(hasta) => set({ hasta })}
          />
        </FilterBar>

        <div className="card-clinical overflow-hidden">
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-hairline bg-secondary/40 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Paciente</span>
            <span>Sucursal</span>
            <span>Última visita</span>
            <span>Estado</span>
            <span>Saldo</span>
            <span>Riesgo</span>
          </div>

          <div className="divide-y divide-hairline">
            {isLoading && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Cargando pacientes…
              </p>
            )}

            {!isLoading &&
              pagina.items.map((p) => {
                const sucursal = sucursales.find((s) => s.id === p.sucursalId);
                const profesional = profesionales.find((pr) => pr.id === p.profesionalId);
                return (
                  <Link
                    key={p.id}
                    to="/pacientes/$pacienteId"
                    params={{ pacienteId: p.id }}
                    className="grid gap-2 px-5 py-4 transition-colors hover:bg-secondary/50 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] md:items-center md:gap-4"
                  >
                    <div className="flex items-center gap-3">
                      {p.foto ? (
                        <img
                          src={p.foto}
                          alt={p.nombre}
                          width={512}
                          height={512}
                          loading="lazy"
                          className="size-9 rounded-full object-cover"
                        />
                      ) : (
                        <span className="grid size-9 place-items-center rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground">
                          {p.nombre
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.documento} · {profesional?.nombre ?? "Sin profesional asignado"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{sucursal?.nombre ?? "—"}</span>
                    <span className="text-xs text-muted-foreground">{p.ultimaVisita}</span>
                    <span
                      className={cn(
                        "w-fit rounded px-1.5 py-0.5 text-[10px] font-medium",
                        p.estado === "activo"
                          ? "bg-success-soft text-success"
                          : p.estado === "nuevo"
                            ? "bg-ai-soft text-ai"
                            : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {etiquetaEstadoPaciente[p.estado]}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        p.saldo != null && p.saldo > 0
                          ? "font-medium text-warning"
                          : "text-muted-foreground",
                      )}
                    >
                      {p.saldo == null
                        ? "Sin datos"
                        : p.saldo > 0
                          ? formatoMoneda(p.saldo)
                          : "Al día"}
                    </span>
                    <span
                      className={cn(
                        "w-fit rounded px-1.5 py-0.5 text-[10px] font-medium",
                        p.riesgoAusencia == null
                          ? "bg-secondary text-muted-foreground"
                          : p.riesgoAusencia > 50
                            ? "bg-destructive/10 text-destructive"
                            : p.riesgoAusencia > 25
                              ? "bg-warning-soft text-warning"
                              : "bg-success-soft text-success",
                      )}
                    >
                      {p.riesgoAusencia == null ? "Sin calcular" : `${p.riesgoAusencia}% ausencia`}
                    </span>
                  </Link>
                );
              })}

            {!isLoading && pagina.items.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                {pacientes.length === 0
                  ? "Todavía no hay pacientes registrados en esta clínica."
                  : "No hay pacientes que coincidan con los filtros aplicados."}
              </p>
            )}
          </div>

          <Paginacion
            pagina={pagina}
            etiqueta="pacientes"
            onPage={(page) => navigate({ search: (p: PacientesSearch) => ({ ...p, page }) })}
          />
        </div>
      </div>
    </AppShell>
  );
}
