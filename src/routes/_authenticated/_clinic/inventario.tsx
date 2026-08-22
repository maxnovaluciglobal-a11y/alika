import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, History, Loader2, Package, Plus, Repeat } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hasPermission } from "@/lib/access";
import { formatMoney } from "@/lib/finance";
import {
  createInventoryItem,
  listInventoryItems,
  listInventoryMovements,
  registerInventoryMovement,
  updateInventoryItem,
  type InventoryItem,
  type InventoryMovementKind,
} from "@/lib/inventory.functions";
import { requirePermission } from "@/lib/route-guards";

const MOVEMENT_LABELS: Record<InventoryMovementKind, string> = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste (recuento)",
};

/** Roles que pueden registrar movimientos de stock (INSERT en
 * inventory_movements) — mismo set que la policy `inventory_movements_insert_clinical`.
 * reception queda afuera aunque sí puede ver inventario. */
const MOVEMENT_ROLES = new Set(["owner", "admin", "dentist", "assistant"]);

function inputClass() {
  return "w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50";
}

function CrearItemDialog({ clinicId }: { clinicId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [minStock, setMinStock] = useState("");
  const [costPesos, setCostPesos] = useState("");
  const [notes, setNotes] = useState("");

  const queryClient = useQueryClient();
  const createFn = useServerFn(createInventoryItem);

  const crear = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          clinicId,
          name: name.trim(),
          unit: unit.trim(),
          minStock: minStock.trim() === "" ? null : Number(minStock),
          costCents: costPesos.trim() === "" ? null : Math.round(Number(costPesos) * 100),
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items", clinicId] });
      toast.success("Ítem creado.");
      setOpen(false);
      setName("");
      setUnit("");
      setMinStock("");
      setCostPesos("");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Nuevo ítem
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo ítem de inventario</DialogTitle>
          <DialogDescription>
            El stock inicial se carga después con un movimiento de entrada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="inv-nombre">Nombre</Label>
            <input
              id="inv-nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass()}
              placeholder="Guantes de nitrilo talla M"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-unidad">Unidad</Label>
              <input
                id="inv-unidad"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={inputClass()}
                placeholder="caja / unidad / ml"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-min">Stock mínimo (opcional)</Label>
              <input
                id="inv-min"
                type="number"
                min={0}
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className={inputClass()}
                placeholder="Sin alerta configurada"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-costo">Costo unitario (opcional)</Label>
            <input
              id="inv-costo"
              type="number"
              min={0}
              step="0.01"
              value={costPesos}
              onChange={(e) => setCostPesos(e.target.value)}
              className={inputClass()}
              placeholder="Sin costo cargado"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-notas">Notas (opcional)</Label>
            <input
              id="inv-notas"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => crear.mutate()}
            disabled={crear.isPending || !name.trim() || !unit.trim()}
          >
            {crear.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Crear ítem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarItemDialog({ clinicId, item }: { clinicId: string; item: InventoryItem }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(item.name);
  const [unit, setUnit] = useState(item.unit);
  const [minStock, setMinStock] = useState(item.minStock == null ? "" : String(item.minStock));
  const [costPesos, setCostPesos] = useState(
    item.costCents == null ? "" : String(item.costCents / 100),
  );
  const [notes, setNotes] = useState(item.notes ?? "");
  const [isActive, setIsActive] = useState(item.isActive);

  const queryClient = useQueryClient();
  const updateFn = useServerFn(updateInventoryItem);

  const guardar = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          clinicId,
          itemId: item.id,
          name: name.trim(),
          unit: unit.trim(),
          minStock: minStock.trim() === "" ? null : Number(minStock),
          costCents: costPesos.trim() === "" ? null : Math.round(Number(costPesos) * 100),
          notes: notes.trim() || undefined,
          isActive,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items", clinicId] });
      toast.success("Ítem actualizado.");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {item.name}</DialogTitle>
          <DialogDescription>
            El stock actual no se edita acá — se ajusta con un movimiento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`ei-nombre-${item.id}`}>Nombre</Label>
            <input
              id={`ei-nombre-${item.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass()}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`ei-unidad-${item.id}`}>Unidad</Label>
              <input
                id={`ei-unidad-${item.id}`}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={inputClass()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`ei-min-${item.id}`}>Stock mínimo</Label>
              <input
                id={`ei-min-${item.id}`}
                type="number"
                min={0}
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className={inputClass()}
                placeholder="Sin alerta configurada"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`ei-costo-${item.id}`}>Costo unitario</Label>
            <input
              id={`ei-costo-${item.id}`}
              type="number"
              min={0}
              step="0.01"
              value={costPesos}
              onChange={(e) => setCostPesos(e.target.value)}
              className={inputClass()}
              placeholder="Sin costo cargado"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`ei-notas-${item.id}`}>Notas</Label>
            <input
              id={`ei-notas-${item.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass()}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Ítem activo (desmarcar = dar de baja, no borra el historial)
          </label>
        </div>
        <DialogFooter>
          <Button
            onClick={() => guardar.mutate()}
            disabled={guardar.isPending || !name.trim() || !unit.trim()}
          >
            {guardar.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegistrarMovimientoDialog({ clinicId, item }: { clinicId: string; item: InventoryItem }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<InventoryMovementKind>("entrada");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const queryClient = useQueryClient();
  const registerFn = useServerFn(registerInventoryMovement);

  const registrar = useMutation({
    mutationFn: () =>
      registerFn({
        data: {
          clinicId,
          itemId: item.id,
          kind,
          quantity: Number(quantity),
          reason: reason.trim() || undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-movements", clinicId, item.id] });
      toast.success("Movimiento registrado.");
      setOpen(false);
      setQuantity("");
      setReason("");
      setKind("entrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Repeat className="size-3.5" /> Movimiento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar movimiento — {item.name}</DialogTitle>
          <DialogDescription>
            Stock actual: {item.currentStock} {item.unit}. Un movimiento no se puede editar después
            — un error se corrige con un ajuste nuevo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`mv-tipo-${item.id}`}>Tipo</Label>
            <select
              id={`mv-tipo-${item.id}`}
              value={kind}
              onChange={(e) => setKind(e.target.value as InventoryMovementKind)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {(Object.keys(MOVEMENT_LABELS) as InventoryMovementKind[]).map((k) => (
                <option key={k} value={k}>
                  {MOVEMENT_LABELS[k]}
                </option>
              ))}
            </select>
            {kind === "ajuste" && (
              <p className="text-xs text-muted-foreground">
                El ajuste fija el stock al valor contado (recuento físico), no lo suma ni lo resta.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`mv-cant-${item.id}`}>
              {kind === "ajuste" ? "Stock contado" : "Cantidad"}
            </Label>
            <input
              id={`mv-cant-${item.id}`}
              type="number"
              min={0}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputClass()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`mv-motivo-${item.id}`}>Motivo (opcional)</Label>
            <input
              id={`mv-motivo-${item.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass()}
              placeholder="compra, uso en tratamiento, merma, conteo físico…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => registrar.mutate()}
            disabled={registrar.isPending || !quantity.trim() || Number(quantity) <= 0}
          >
            {registrar.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistorialMovimientosDialog({ clinicId, item }: { clinicId: string; item: InventoryItem }) {
  const [open, setOpen] = useState(false);
  const fetchMovements = useServerFn(listInventoryMovements);

  const movementsQuery = useQuery({
    queryKey: ["inventory-movements", clinicId, item.id],
    queryFn: () => fetchMovements({ data: { clinicId, itemId: item.id } }),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <History className="size-3.5" /> Historial
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historial — {item.name}</DialogTitle>
          <DialogDescription>Movimientos más recientes primero.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          {movementsQuery.isLoading && (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Cargando historial…
            </p>
          )}
          {movementsQuery.isError && (
            <p className="py-6 text-sm text-muted-foreground">No pudimos cargar el historial.</p>
          )}
          {movementsQuery.data && movementsQuery.data.items.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">Todavía no hay movimientos.</p>
          )}
          {movementsQuery.data && movementsQuery.data.items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementsQuery.data.items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(m.recordedAt).toLocaleString("es-CL")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.kind === "salida" ? "destructive" : "secondary"}>
                        {MOVEMENT_LABELS[m.kind]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {m.quantity} {item.unit}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.reason ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {movementsQuery.data?.truncated && (
            <p className="pt-3 text-xs text-muted-foreground">
              Hay más movimientos de los que se muestran acá.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const Route = createFileRoute("/_authenticated/_clinic/inventario")({
  beforeLoad: requirePermission("inventory:view"),
  head: () => ({
    meta: [
      { title: "Inventario | Alika" },
      {
        name: "description",
        content: "Control de stock de insumos y materiales de la clínica.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InventarioPage,
});

function InventarioPage() {
  const { access } = Route.useRouteContext();
  const clinicId = access.clinic!.id;
  const puedeGestionar = hasPermission(access.role, "inventory:manage");
  const puedeRegistrarMovimiento = access.role != null && MOVEMENT_ROLES.has(access.role);

  const fetchItems = useServerFn(listInventoryItems);
  const itemsQuery = useQuery({
    queryKey: ["inventory-items", clinicId],
    queryFn: () => fetchItems({ data: { clinicId } }),
  });

  const items = itemsQuery.data?.items ?? [];
  const activeItems = items.filter((i) => i.isActive);
  const inactiveItems = items.filter((i) => !i.isActive);
  const lowStockCount = activeItems.filter((i) => i.belowMinStock).length;

  return (
    <AppShell title="Inventario" access={access}>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">
              Insumos y materiales de {access.clinic!.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {lowStockCount > 0
                ? `${lowStockCount} ítem${lowStockCount === 1 ? "" : "s"} bajo el stock mínimo.`
                : "Todo el stock está sobre el mínimo configurado."}
            </p>
          </div>
          {puedeGestionar && <CrearItemDialog clinicId={clinicId} />}
        </div>

        <section className="card-clinical divide-y divide-hairline">
          {itemsQuery.isLoading && (
            <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Cargando inventario…
            </p>
          )}
          {itemsQuery.isError && (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No pudimos cargar el inventario.
            </p>
          )}
          {itemsQuery.data && activeItems.length === 0 && (
            <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
              <Package className="size-4" /> Todavía no hay ítems de inventario cargados.
            </p>
          )}
          {activeItems.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ítem</TableHead>
                  <TableHead>Stock actual</TableHead>
                  <TableHead>Mínimo</TableHead>
                  <TableHead>Costo unitario</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.name}
                      {item.notes && (
                        <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                          {item.notes}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>
                          {item.currentStock} {item.unit}
                        </span>
                        {item.belowMinStock && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="size-3" /> Bajo mínimo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.minStock == null
                        ? "Sin alerta configurada"
                        : `${item.minStock} ${item.unit}`}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.costCents == null ? "Sin costo cargado" : formatMoney(item.costCents)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        <HistorialMovimientosDialog clinicId={clinicId} item={item} />
                        {puedeRegistrarMovimiento && (
                          <RegistrarMovimientoDialog clinicId={clinicId} item={item} />
                        )}
                        {puedeGestionar && <EditarItemDialog clinicId={clinicId} item={item} />}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        {puedeGestionar && inactiveItems.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-display text-sm font-semibold text-muted-foreground">
              Ítems dados de baja
            </h3>
            <div className="card-clinical divide-y divide-hairline">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ítem</TableHead>
                    <TableHead>Último stock</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactiveItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.currentStock} {item.unit}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <HistorialMovimientosDialog clinicId={clinicId} item={item} />
                          <EditarItemDialog clinicId={clinicId} item={item} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
