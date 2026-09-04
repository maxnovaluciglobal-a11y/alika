import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Download, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
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
import { FilterBar, SelectField } from "@/components/filters";
import { PatientCombobox } from "@/components/patient-combobox";
import { requirePermission } from "@/lib/route-guards";
import { hoyISO, formatoFecha } from "@/lib/clinic-data";
import {
  LAB_ORDER_STATUSES,
  LAB_ORDER_STATUS_LABELS,
  formatMoney,
  ordenAtrasada,
  type LabOrder,
  type LabOrderStatus,
} from "@/lib/finance";
import {
  createLab,
  createLabOrder,
  listLabOrders,
  listLabs,
  setLabOrderStatus,
} from "@/lib/clinic-operations.functions";
import { listPatients } from "@/lib/patients.functions";
import { exportarCsv } from "@/lib/csv-export";
import { str } from "@/lib/search";
import { cn } from "@/lib/utils";

interface LabSearch {
  estado: string;
}

export const Route = createFileRoute("/_authenticated/_clinic/laboratorios")({
  validateSearch: (search: Record<string, unknown>): LabSearch => ({
    estado: str(search.estado),
  }),
  beforeLoad: requirePermission("treatments:view"),
  head: () => ({
    meta: [
      { title: "Laboratorios | Alika" },
      {
        name: "description",
        content:
          "Órdenes de laboratorio con estado, fecha comprometida y costo, para dejar de llevar el cuaderno aparte.",
      },
    ],
  }),
  component: LaboratoriosPage,
});

const INPUT =
  "w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const TONO_ESTADO: Record<LabOrderStatus, string> = {
  enviado: "bg-ai-soft text-ai",
  en_proceso: "bg-warning-soft text-warning",
  recibido: "bg-success-soft text-success",
  reprocesar: "bg-destructive/10 text-destructive",
  cancelado: "bg-secondary text-muted-foreground",
};

function NuevoLaboratorioDialog({ clinicId }: { clinicId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const queryClient = useQueryClient();
  const createFn = useServerFn(createLab);

  const crear = useMutation({
    mutationFn: () =>
      createFn({ data: { clinicId, name: name.trim(), contactPhone: phone.trim() || null } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labs", clinicId] });
      toast.success("Laboratorio creado");
      setOpen(false);
      setName("");
      setPhone("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" /> Nuevo laboratorio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuevo laboratorio</DialogTitle>
          <DialogDescription>
            Con el nombre alcanza para empezar a mandarle trabajos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="l-name">Nombre</Label>
            <input
              id="l-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Laboratorio Dental Sur"
              className={INPUT}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-phone">Teléfono</Label>
            <input
              id="l-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Opcional"
              className={INPUT}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => crear.mutate()} disabled={!name.trim() || crear.isPending}>
            {crear.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Crear laboratorio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NuevaOrdenDialog({ clinicId, timezone }: { clinicId: string; timezone?: string }) {
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [labId, setLabId] = useState("");
  const [description, setDescription] = useState("");
  const [piezas, setPiezas] = useState("");
  const [sentOn, setSentOn] = useState(hoyISO(timezone));
  const [dueOn, setDueOn] = useState("");
  const [cost, setCost] = useState(0);
  const queryClient = useQueryClient();
  const createFn = useServerFn(createLabOrder);
  const fetchLabs = useServerFn(listLabs);
  const fetchPatients = useServerFn(listPatients);

  const { data: labs = [] } = useQuery({
    queryKey: ["labs", clinicId],
    enabled: open,
    queryFn: () => fetchLabs({ data: { clinicId } }),
  });
  const { data: pacientesRes } = useQuery({
    queryKey: ["patients", clinicId],
    enabled: open,
    queryFn: () => fetchPatients({ data: { clinicId } }),
  });

  const crear = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          clinicId,
          patientId,
          labId: labId || null,
          description: description.trim(),
          // "24, 25" → [24, 25]. Se descarta lo que no sea número en vez de
          // rechazar la orden entera por un separador raro.
          toothNumbers:
            piezas
              .split(/[\s,;]+/)
              .map((t) => Number(t))
              .filter((n) => Number.isInteger(n) && n > 0) || null,
          sentOn,
          dueOn: dueOn || null,
          costCents: cost > 0 ? cost : null,
          currency: "CLP",
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-orders", clinicId] });
      toast.success("Orden registrada");
      setOpen(false);
      setPatientId("");
      setDescription("");
      setPiezas("");
      setDueOn("");
      setCost(0);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const listo = patientId && description.trim() && !crear.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Nueva orden
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva orden de laboratorio</DialogTitle>
          <DialogDescription>
            Lo que se manda al taller, para quién y cuándo lo prometieron.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Paciente</Label>
            <PatientCombobox
              value={patientId}
              onChange={setPatientId}
              pacientes={(pacientesRes?.items ?? []).map((p) => ({
                id: p.id,
                nombre: p.nombre,
              }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="o-lab">Laboratorio</Label>
              <select
                id="o-lab"
                value={labId}
                onChange={(e) => setLabId(e.target.value)}
                className={INPUT}
              >
                <option value="">Sin especificar</option>
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-piezas">Piezas</Label>
              <input
                id="o-piezas"
                value={piezas}
                onChange={(e) => setPiezas(e.target.value)}
                placeholder="Ej: 24, 25"
                className={INPUT}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="o-desc">Trabajo</Label>
            <input
              id="o-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Corona metal-porcelana"
              className={INPUT}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="o-sent">Enviado</Label>
              <input
                id="o-sent"
                type="date"
                value={sentOn}
                onChange={(e) => setSentOn(e.target.value)}
                className={INPUT}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-due">Comprometido</Label>
              <input
                id="o-due"
                type="date"
                value={dueOn}
                onChange={(e) => setDueOn(e.target.value)}
                className={INPUT}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-cost">Costo</Label>
              <input
                id="o-cost"
                type="number"
                min={0}
                value={cost || ""}
                onChange={(e) => setCost(Number(e.target.value))}
                placeholder="Opcional"
                className={INPUT}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => crear.mutate()} disabled={!listo}>
            {crear.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Registrar orden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LaboratoriosPage() {
  const { access } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const clinicId = access.clinic?.id;
  const currency = access.clinic?.currency ?? "CLP";
  const timezone = access.clinic?.timezone;
  const hoy = hoyISO(timezone);
  const queryClient = useQueryClient();

  const fetchOrders = useServerFn(listLabOrders);
  const setStatusFn = useServerFn(setLabOrderStatus);

  const { data: ordenes = [], isLoading } = useQuery({
    queryKey: ["lab-orders", clinicId, search.estado],
    enabled: Boolean(clinicId),
    queryFn: () =>
      fetchOrders({
        data: {
          clinicId: clinicId!,
          estado: (search.estado || null) as LabOrderStatus | null,
        },
      }),
  });

  const cambiarEstado = useMutation({
    mutationFn: (v: { orderId: string; status: LabOrderStatus }) =>
      setStatusFn({
        data: {
          clinicId: clinicId!,
          ...v,
          receivedOn: v.status === "recibido" ? hoy : null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-orders", clinicId] });
      toast.success("Estado actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atrasadas = useMemo(() => ordenes.filter((o) => ordenAtrasada(o, hoy)), [ordenes, hoy]);

  const exportar = () =>
    exportarCsv<LabOrder>(
      ordenes,
      [
        { header: "Enviado", value: (o) => o.sentOn },
        { header: "Paciente", value: (o) => o.patientName },
        { header: "Laboratorio", value: (o) => o.labNameSnapshot },
        { header: "Trabajo", value: (o) => o.description },
        { header: "Piezas", value: (o) => o.toothNumbers?.join(" ") ?? null },
        { header: "Estado", value: (o) => LAB_ORDER_STATUS_LABELS[o.status] },
        { header: "Comprometido", value: (o) => o.dueOn },
        { header: "Recibido", value: (o) => o.receivedOn },
        { header: "Costo", value: (o) => o.costCents },
      ],
      "ordenes-laboratorio",
      hoy,
    );

  const set = (patch: Partial<LabSearch>) =>
    navigate({ search: (prev: LabSearch) => ({ ...prev, ...patch }) });

  return (
    <AppShell title="Laboratorios" access={access}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {ordenes.length} {ordenes.length === 1 ? "orden" : "órdenes"}
            {atrasadas.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-destructive">
                <AlertTriangle className="size-3.5" />
                {atrasadas.length} con el plazo vencido
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {ordenes.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportar}>
                <Download className="size-4" /> Exportar CSV
              </Button>
            )}
            <NuevoLaboratorioDialog clinicId={clinicId!} />
            <NuevaOrdenDialog clinicId={clinicId!} timezone={timezone} />
          </div>
        </div>

        <FilterBar activos={search.estado ? 1 : 0} onReset={() => set({ estado: "" })}>
          <SelectField
            label="Estado"
            value={search.estado}
            onChange={(estado) => set({ estado })}
            allLabel="Todos los estados"
            options={LAB_ORDER_STATUSES.map((e) => ({
              value: e,
              label: LAB_ORDER_STATUS_LABELS[e],
            }))}
          />
        </FilterBar>

        {isLoading && <p className="text-sm text-muted-foreground">Cargando órdenes…</p>}

        {!isLoading && ordenes.length === 0 && (
          <div className="card-clinical p-8 text-center">
            <p className="mb-1 font-display text-lg font-semibold">Sin órdenes de laboratorio</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Registrá acá lo que mandás al taller: qué, para quién y cuándo lo prometieron. Es lo
              que hoy vive en un cuaderno aparte.
            </p>
          </div>
        )}

        {!isLoading && ordenes.length > 0 && (
          <section className="card-clinical overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-sm">
                <thead>
                  <tr className="border-b border-hairline text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Enviado</th>
                    <th className="px-3 py-2 text-left font-medium">Paciente</th>
                    <th className="px-3 py-2 text-left font-medium">Trabajo</th>
                    <th className="px-3 py-2 text-left font-medium">Laboratorio</th>
                    <th className="px-3 py-2 text-left font-medium">Comprometido</th>
                    <th className="px-3 py-2 text-right font-medium">Costo</th>
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenes.map((o) => {
                    const atrasada = ordenAtrasada(o, hoy);
                    return (
                      <tr key={o.id} className="border-b border-hairline last:border-0">
                        <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
                          {formatoFecha(o.sentOn)}
                        </td>
                        <td className="px-3 py-2">{o.patientName}</td>
                        <td className="px-3 py-2">
                          {o.description}
                          {o.toothNumbers?.length ? (
                            <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {o.toothNumbers.join(" · ")}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {o.labNameSnapshot ?? "—"}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-3 py-2 font-mono text-xs",
                            atrasada ? "font-semibold text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {o.dueOn ? formatoFecha(o.dueOn) : "—"}
                          {atrasada && <span className="ml-1">⚠</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                          {o.costCents === null ? "—" : formatMoney(o.costCents, o.currency)}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={o.status}
                            aria-label={`Estado de la orden de ${o.patientName}`}
                            onChange={(e) =>
                              cambiarEstado.mutate({
                                orderId: o.id,
                                status: e.target.value as LabOrderStatus,
                              })
                            }
                            className={cn(
                              "rounded-md border-0 px-2 py-1 text-xs font-medium",
                              TONO_ESTADO[o.status],
                            )}
                          >
                            {LAB_ORDER_STATUSES.map((e) => (
                              <option key={e} value={e}>
                                {LAB_ORDER_STATUS_LABELS[e]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <p className="text-xs text-muted-foreground">
          Una orden solo cuenta como atrasada si el laboratorio comprometió una fecha y todavía no
          llegó — sin plazo pactado no se inventa uno.
        </p>
      </div>
    </AppShell>
  );
}
