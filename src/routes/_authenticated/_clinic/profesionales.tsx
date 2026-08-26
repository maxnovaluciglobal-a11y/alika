import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Loader2, Plus, UserRound } from "lucide-react";
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
import { listBranches, listSpecialties } from "@/lib/clinic-catalog.functions";
import {
  createProfessional,
  getProfessionalSchedule,
  listProfessionalsDetailed,
  setProfessionalSchedule,
  updateProfessional,
  type ProfessionalDetail,
  type ScheduleBlock,
} from "@/lib/professionals.functions";
import { requirePermission } from "@/lib/route-guards";

function inputClass() {
  return "w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50";
}

/** Orden de despliegue lunes→domingo. El value es el day_of_week real
 * (0=domingo…6=sábado, igual que Date.getDay()) — solo el orden visual
 * cambia, no el dato. */
const DAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

type ProfessionalFormState = {
  fullName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  color: string;
  branchId: string | null;
  specialtyId: string | null;
};

const EMPTY_FORM: ProfessionalFormState = {
  fullName: "",
  email: "",
  phone: "",
  licenseNumber: "",
  color: "#0d9488",
  branchId: null,
  specialtyId: null,
};

function ProfessionalFields({
  form,
  onChange,
  branches,
  specialties,
  idPrefix,
}: {
  form: ProfessionalFormState;
  onChange: (next: ProfessionalFormState) => void;
  branches: { id: string; nombre: string }[];
  specialties: { id: string; name: string }[];
  idPrefix: string;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-nombre`}>Nombre completo</Label>
        <input
          id={`${idPrefix}-nombre`}
          value={form.fullName}
          onChange={(e) => onChange({ ...form, fullName: e.target.value })}
          className={inputClass()}
          placeholder="Dra. Carolina Rodríguez"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-email`}>Email</Label>
          <input
            id={`${idPrefix}-email`}
            type="email"
            value={form.email}
            onChange={(e) => onChange({ ...form, email: e.target.value })}
            className={inputClass()}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-telefono`}>Teléfono</Label>
          <input
            id={`${idPrefix}-telefono`}
            value={form.phone}
            onChange={(e) => onChange({ ...form, phone: e.target.value })}
            className={inputClass()}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-matricula`}>Matrícula (opcional)</Label>
          <input
            id={`${idPrefix}-matricula`}
            value={form.licenseNumber}
            onChange={(e) => onChange({ ...form, licenseNumber: e.target.value })}
            className={inputClass()}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-color`}>Color en agenda</Label>
          <input
            id={`${idPrefix}-color`}
            type="color"
            value={form.color}
            onChange={(e) => onChange({ ...form, color: e.target.value })}
            className="h-9 w-full rounded-lg border border-hairline bg-transparent px-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-sucursal`}>Sucursal</Label>
          <select
            id={`${idPrefix}-sucursal`}
            value={form.branchId ?? ""}
            onChange={(e) => onChange({ ...form, branchId: e.target.value || null })}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <option value="">Sin asignar</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-especialidad`}>Especialidad</Label>
          <select
            id={`${idPrefix}-especialidad`}
            value={form.specialtyId ?? ""}
            onChange={(e) => onChange({ ...form, specialtyId: e.target.value || null })}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <option value="">Sin asignar</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function NuevoProfesionalDialog({
  clinicId,
  branches,
  specialties,
}: {
  clinicId: string;
  branches: { id: string; nombre: string }[];
  specialties: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProfessionalFormState>(EMPTY_FORM);

  const queryClient = useQueryClient();
  const createFn = useServerFn(createProfessional);

  const crear = useMutation({
    mutationFn: () => createFn({ data: { clinicId, professional: form } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professionals-detailed", clinicId] });
      toast.success("Profesional agregado.");
      setOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => (setOpen(v), v || setForm(EMPTY_FORM))}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Nuevo profesional
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo profesional</DialogTitle>
          <DialogDescription>
            El horario de atención se configura después, desde "Horario" en la lista.
          </DialogDescription>
        </DialogHeader>
        <ProfessionalFields
          form={form}
          onChange={setForm}
          branches={branches}
          specialties={specialties}
          idPrefix="np"
        />
        <DialogFooter>
          <Button
            onClick={() => crear.mutate()}
            disabled={crear.isPending || form.fullName.trim().length < 2}
          >
            {crear.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Crear profesional
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarProfesionalDialog({
  clinicId,
  professional,
  branches,
  specialties,
}: {
  clinicId: string;
  professional: ProfessionalDetail;
  branches: { id: string; nombre: string }[];
  specialties: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProfessionalFormState>({
    fullName: professional.fullName,
    email: professional.email ?? "",
    phone: professional.phone ?? "",
    licenseNumber: professional.licenseNumber ?? "",
    color: professional.color,
    branchId: professional.branchId,
    specialtyId: professional.specialtyId,
  });
  const [isActive, setIsActive] = useState(professional.isActive);

  const queryClient = useQueryClient();
  const updateFn = useServerFn(updateProfessional);

  const guardar = useMutation({
    mutationFn: () =>
      updateFn({
        data: { clinicId, professionalId: professional.id, professional: form, isActive },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professionals-detailed", clinicId] });
      toast.success("Profesional actualizado.");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar {professional.fullName}</DialogTitle>
        </DialogHeader>
        <ProfessionalFields
          form={form}
          onChange={setForm}
          branches={branches}
          specialties={specialties}
          idPrefix={`ep-${professional.id}`}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Profesional activo (desmarcar = dar de baja, no borra su historial)
        </label>
        <DialogFooter>
          <Button
            onClick={() => guardar.mutate()}
            disabled={guardar.isPending || form.fullName.trim().length < 2}
          >
            {guardar.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HorarioDialog({
  clinicId,
  professional,
}: {
  clinicId: string;
  professional: ProfessionalDetail;
}) {
  const [open, setOpen] = useState(false);
  // Map día → bloque activo o null (no atiende ese día).
  const [dias, setDias] = useState<Record<number, { start: string; end: string } | null>>({});

  const fetchSchedule = useServerFn(getProfessionalSchedule);
  const scheduleQuery = useQuery({
    queryKey: ["professional-schedule", clinicId, professional.id],
    queryFn: () => fetchSchedule({ data: { clinicId, professionalId: professional.id } }),
    enabled: open,
  });

  useEffect(() => {
    if (!scheduleQuery.data) return;
    const next: Record<number, { start: string; end: string } | null> = {};
    for (const d of DAYS) next[d.value] = null;
    for (const block of scheduleQuery.data as ScheduleBlock[]) {
      next[block.dayOfWeek] = { start: block.startTime, end: block.endTime };
    }
    setDias(next);
  }, [scheduleQuery.data]);

  const queryClient = useQueryClient();
  const saveFn = useServerFn(setProfessionalSchedule);

  const guardar = useMutation({
    mutationFn: () => {
      const blocks = DAYS.filter((d) => dias[d.value]).map((d) => ({
        dayOfWeek: d.value,
        startTime: dias[d.value]!.start,
        endTime: dias[d.value]!.end,
      }));
      return saveFn({ data: { clinicId, professionalId: professional.id, blocks } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["professional-schedule", clinicId, professional.id],
      });
      toast.success("Horario actualizado.");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalido = DAYS.some((d) => {
    const b = dias[d.value];
    return b && b.start >= b.end;
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Clock className="size-3.5" /> Horario
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Horario — {professional.fullName}</DialogTitle>
          <DialogDescription>
            Sin ningún día marcado, no hay restricción: se puede agendar cualquier día/hora dentro
            del horario de la sucursal, como hasta ahora. Un día sin tildar acá significa que no
            atiende ese día.
          </DialogDescription>
        </DialogHeader>
        {scheduleQuery.isLoading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Cargando horario…
          </p>
        ) : (
          <div className="space-y-2">
            {DAYS.map((d) => {
              const bloque = dias[d.value];
              return (
                <div key={d.value} className="flex items-center gap-3">
                  <label className="flex w-28 shrink-0 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(bloque)}
                      onChange={(e) =>
                        setDias({
                          ...dias,
                          [d.value]: e.target.checked ? { start: "09:00", end: "18:00" } : null,
                        })
                      }
                    />
                    {d.label}
                  </label>
                  <input
                    type="time"
                    value={bloque?.start ?? ""}
                    disabled={!bloque}
                    onChange={(e) =>
                      setDias({ ...dias, [d.value]: { ...bloque!, start: e.target.value } })
                    }
                    className={inputClass() + " disabled:opacity-40"}
                  />
                  <span className="text-xs text-muted-foreground">a</span>
                  <input
                    type="time"
                    value={bloque?.end ?? ""}
                    disabled={!bloque}
                    onChange={(e) =>
                      setDias({ ...dias, [d.value]: { ...bloque!, end: e.target.value } })
                    }
                    className={inputClass() + " disabled:opacity-40"}
                  />
                </div>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button onClick={() => guardar.mutate()} disabled={guardar.isPending || invalido}>
            {guardar.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Guardar horario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const Route = createFileRoute("/_authenticated/_clinic/profesionales")({
  beforeLoad: requirePermission("settings:manage"),
  head: () => ({
    meta: [
      { title: "Profesionales | Alika" },
      {
        name: "description",
        content: "Administra los profesionales de la clínica y su horario de atención.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfesionalesPage,
});

function ProfesionalesPage() {
  const { access } = Route.useRouteContext();
  const clinicId = access.clinic!.id;

  const fetchProfessionals = useServerFn(listProfessionalsDetailed);
  const professionalsQuery = useQuery({
    queryKey: ["professionals-detailed", clinicId],
    queryFn: () => fetchProfessionals({ data: { clinicId } }),
  });

  const fetchBranches = useServerFn(listBranches);
  const branchesQuery = useQuery({
    queryKey: ["branches", clinicId],
    queryFn: () => fetchBranches({ data: { clinicId } }),
  });

  const fetchSpecialties = useServerFn(listSpecialties);
  const specialtiesQuery = useQuery({
    queryKey: ["specialties", clinicId],
    queryFn: () => fetchSpecialties({ data: { clinicId } }),
  });

  const professionals = professionalsQuery.data ?? [];
  const activeProfessionals = professionals.filter((p) => p.isActive);
  const inactiveProfessionals = professionals.filter((p) => !p.isActive);
  const branches = branchesQuery.data ?? [];
  const specialties = specialtiesQuery.data ?? [];

  return (
    <AppShell title="Profesionales" access={access}>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">
              Profesionales de {access.clinic!.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {activeProfessionals.length} activo{activeProfessionals.length === 1 ? "" : "s"}.
            </p>
          </div>
          <NuevoProfesionalDialog
            clinicId={clinicId}
            branches={branches}
            specialties={specialties}
          />
        </div>

        <section className="card-clinical divide-y divide-hairline">
          {professionalsQuery.isLoading && (
            <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Cargando profesionales…
            </p>
          )}
          {professionalsQuery.isError && (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No pudimos cargar los profesionales.
            </p>
          )}
          {professionalsQuery.data && activeProfessionals.length === 0 && (
            <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
              <UserRound className="size-4" /> Todavía no hay profesionales cargados.
            </p>
          )}
          {activeProfessionals.map((professional) => (
            <div
              key={professional.id}
              className="flex flex-wrap items-start justify-between gap-4 px-5 py-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-1 size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: professional.color }}
                />
                <div>
                  <p className="font-medium">{professional.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {professional.specialtyName ?? "Sin especialidad"}
                    {professional.branchName ? ` · ${professional.branchName}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <HorarioDialog clinicId={clinicId} professional={professional} />
                <EditarProfesionalDialog
                  clinicId={clinicId}
                  professional={professional}
                  branches={branches}
                  specialties={specialties}
                />
              </div>
            </div>
          ))}
        </section>

        {inactiveProfessionals.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-display text-sm font-semibold text-muted-foreground">
              Profesionales dados de baja
            </h3>
            <div className="card-clinical divide-y divide-hairline">
              {inactiveProfessionals.map((professional) => (
                <div
                  key={professional.id}
                  className="flex flex-wrap items-start justify-between gap-4 px-5 py-4"
                >
                  <p className="text-muted-foreground">{professional.fullName}</p>
                  <EditarProfesionalDialog
                    clinicId={clinicId}
                    professional={professional}
                    branches={branches}
                    specialties={specialties}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
