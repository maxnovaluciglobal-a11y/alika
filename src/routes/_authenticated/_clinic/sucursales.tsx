import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
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
import {
  addOperatory,
  createBranch,
  listBranchesDetailed,
  updateBranch,
  type BranchDetail,
} from "@/lib/branches.functions";
import { requirePermission } from "@/lib/route-guards";

function inputClass() {
  return "w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50";
}

type BranchFormState = {
  name: string;
  address: string;
  city: string;
  phone: string;
  opensAt: string;
  closesAt: string;
  operatories: string[];
};

const EMPTY_FORM: BranchFormState = {
  name: "",
  address: "",
  city: "",
  phone: "",
  opensAt: "08:00",
  closesAt: "20:00",
  operatories: ["Box 1"],
};

function OperatoriesEditor({
  operatories,
  onChange,
}: {
  operatories: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Boxes / operatorios</Label>
      <div className="space-y-2">
        {operatories.map((op, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={op}
              onChange={(e) => {
                const next = [...operatories];
                next[i] = e.target.value;
                onChange(next);
              }}
              className={inputClass()}
              placeholder="Box 1"
            />
            {operatories.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(operatories.filter((_, idx) => idx !== i))}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...operatories, ""])}
      >
        <Plus className="size-3.5" /> Agregar box
      </Button>
    </div>
  );
}

function NuevaSucursalDialog({ clinicId }: { clinicId: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BranchFormState>(EMPTY_FORM);

  const queryClient = useQueryClient();
  const createFn = useServerFn(createBranch);

  const crear = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          clinicId,
          branch: {
            ...form,
            operatories: form.operatories.map((o) => o.trim()).filter(Boolean),
          },
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches-detailed", clinicId] });
      toast.success("Sucursal creada.");
      setOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const puedeCrear =
    form.name.trim().length >= 2 &&
    /^\d{2}:\d{2}$/.test(form.opensAt) &&
    /^\d{2}:\d{2}$/.test(form.closesAt) &&
    form.operatories.some((o) => o.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(v) => (setOpen(v), v || setForm(EMPTY_FORM))}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Nueva sucursal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva sucursal</DialogTitle>
          <DialogDescription>
            Se crea con su propio horario y boxes — la agenda y los reportes ya la van a filtrar
            automáticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="suc-nombre">Nombre</Label>
            <input
              id="suc-nombre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass()}
              placeholder="Sucursal Providencia"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="suc-direccion">Dirección</Label>
              <input
                id="suc-direccion"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={inputClass()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suc-ciudad">Ciudad</Label>
              <input
                id="suc-ciudad"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className={inputClass()}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="suc-telefono">Teléfono</Label>
              <input
                id="suc-telefono"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suc-abre">Abre</Label>
              <input
                id="suc-abre"
                type="time"
                value={form.opensAt}
                onChange={(e) => setForm({ ...form, opensAt: e.target.value })}
                className={inputClass()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suc-cierra">Cierra</Label>
              <input
                id="suc-cierra"
                type="time"
                value={form.closesAt}
                onChange={(e) => setForm({ ...form, closesAt: e.target.value })}
                className={inputClass()}
              />
            </div>
          </div>
          <OperatoriesEditor
            operatories={form.operatories}
            onChange={(operatories) => setForm({ ...form, operatories })}
          />
        </div>
        <DialogFooter>
          <Button onClick={() => crear.mutate()} disabled={crear.isPending || !puedeCrear}>
            {crear.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Crear sucursal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarSucursalDialog({ clinicId, branch }: { clinicId: string; branch: BranchDetail }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(branch.name);
  const [address, setAddress] = useState(branch.address ?? "");
  const [city, setCity] = useState(branch.city ?? "");
  const [phone, setPhone] = useState(branch.phone ?? "");
  const [opensAt, setOpensAt] = useState(branch.opensAt.slice(0, 5));
  const [closesAt, setClosesAt] = useState(branch.closesAt.slice(0, 5));
  const [isActive, setIsActive] = useState(branch.isActive);
  const [nuevoBox, setNuevoBox] = useState("");

  const queryClient = useQueryClient();
  const updateFn = useServerFn(updateBranch);
  const addOpFn = useServerFn(addOperatory);

  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: ["branches-detailed", clinicId] });

  const guardar = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          clinicId,
          branchId: branch.id,
          name,
          address,
          city,
          phone,
          opensAt,
          closesAt,
          isActive,
        },
      }),
    onSuccess: () => {
      invalidar();
      toast.success("Sucursal actualizada.");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const agregarBox = useMutation({
    mutationFn: () => addOpFn({ data: { clinicId, branchId: branch.id, name: nuevoBox } }),
    onSuccess: () => {
      invalidar();
      setNuevoBox("");
      toast.success("Box agregado.");
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
          <DialogTitle>Editar {branch.name}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor={`e-nombre-${branch.id}`}>Nombre</Label>
            <input
              id={`e-nombre-${branch.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass()}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`e-direccion-${branch.id}`}>Dirección</Label>
              <input
                id={`e-direccion-${branch.id}`}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputClass()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`e-ciudad-${branch.id}`}>Ciudad</Label>
              <input
                id={`e-ciudad-${branch.id}`}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass()}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`e-telefono-${branch.id}`}>Teléfono</Label>
              <input
                id={`e-telefono-${branch.id}`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`e-abre-${branch.id}`}>Abre</Label>
              <input
                id={`e-abre-${branch.id}`}
                type="time"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className={inputClass()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`e-cierra-${branch.id}`}>Cierra</Label>
              <input
                id={`e-cierra-${branch.id}`}
                type="time"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className={inputClass()}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Sucursal activa (desmarcar = dar de baja, no borra el historial)
          </label>

          <div className="space-y-1.5 border-t border-hairline pt-3">
            <Label>Boxes actuales</Label>
            <div className="flex flex-wrap gap-1.5">
              {branch.operatories.length === 0 && (
                <p className="text-xs text-muted-foreground">Sin boxes cargados.</p>
              )}
              {branch.operatories.map((op) => (
                <Badge key={op.id} variant="secondary">
                  {op.name}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <input
                value={nuevoBox}
                onChange={(e) => setNuevoBox(e.target.value)}
                className={inputClass()}
                placeholder="Box nuevo"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => agregarBox.mutate()}
                disabled={agregarBox.isPending || !nuevoBox.trim()}
              >
                Agregar
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => guardar.mutate()}
            disabled={guardar.isPending || name.trim().length < 2}
          >
            {guardar.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const Route = createFileRoute("/_authenticated/_clinic/sucursales")({
  beforeLoad: requirePermission("settings:manage"),
  head: () => ({
    meta: [
      { title: "Sucursales | Alika" },
      {
        name: "description",
        content: "Administra las sucursales, horarios y boxes de la clínica.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SucursalesPage,
});

function SucursalesPage() {
  const { access } = Route.useRouteContext();
  const clinicId = access.clinic!.id;

  const fetchBranches = useServerFn(listBranchesDetailed);
  const branchesQuery = useQuery({
    queryKey: ["branches-detailed", clinicId],
    queryFn: () => fetchBranches({ data: { clinicId } }),
  });

  const branches = branchesQuery.data ?? [];
  const activeBranches = branches.filter((b) => b.isActive);
  const inactiveBranches = branches.filter((b) => !b.isActive);

  return (
    <AppShell title="Sucursales" access={access}>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">
              Sucursales de {access.clinic!.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {activeBranches.length} sucursal{activeBranches.length === 1 ? "" : "es"} activa
              {activeBranches.length === 1 ? "" : "s"}.
            </p>
          </div>
          <NuevaSucursalDialog clinicId={clinicId} />
        </div>

        <section className="card-clinical divide-y divide-hairline">
          {branchesQuery.isLoading && (
            <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Cargando sucursales…
            </p>
          )}
          {branchesQuery.isError && (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No pudimos cargar las sucursales.
            </p>
          )}
          {branchesQuery.data && activeBranches.length === 0 && (
            <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
              <MapPin className="size-4" /> Todavía no hay sucursales activas.
            </p>
          )}
          {activeBranches.map((branch) => (
            <div
              key={branch.id}
              className="flex flex-wrap items-start justify-between gap-4 px-5 py-4"
            >
              <div>
                <p className="font-medium">{branch.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[branch.address, branch.city].filter(Boolean).join(", ") || "Sin dirección"}
                  {branch.phone ? ` · ${branch.phone}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {branch.opensAt.slice(0, 5)}–{branch.closesAt.slice(0, 5)} ·{" "}
                  {branch.operatories.length} box{branch.operatories.length === 1 ? "" : "es"}
                </p>
              </div>
              <EditarSucursalDialog clinicId={clinicId} branch={branch} />
            </div>
          ))}
        </section>

        {inactiveBranches.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-display text-sm font-semibold text-muted-foreground">
              Sucursales dadas de baja
            </h3>
            <div className="card-clinical divide-y divide-hairline">
              {inactiveBranches.map((branch) => (
                <div
                  key={branch.id}
                  className="flex flex-wrap items-start justify-between gap-4 px-5 py-4"
                >
                  <p className="text-muted-foreground">{branch.name}</p>
                  <EditarSucursalDialog clinicId={clinicId} branch={branch} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
