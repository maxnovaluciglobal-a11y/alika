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
import { listBranches } from "@/lib/clinic-catalog.functions";
import type { Sucursal } from "@/lib/clinic-data";
import { formatMoney, fromCents, toCents } from "@/lib/finance";
import {
  createInventoryItem,
  listExpiringLots,
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

function CrearItemDialog({
  clinicId,
  currency,
  sucursales,
}: {
  clinicId: string;
  currency: string;
  /** Vacío o con 1 elemento = no se muestra el selector (caso común). */
  sucursales: Sucursal[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [minStock, setMinStock] = useState("");
  const [costPesos, setCostPesos] = useState("");
  const [notes, setNotes] = useState("");
  const [branchId, setBranchId] = useState("");

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
          costCents: costPesos.trim() === "" ? null : toCents(Number(costPesos), currency),
          notes: notes.trim() || undefined,
          branchId: sucursales.length > 1 ? branchId || null : undefined,
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
      setBranchId("");
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
          {sucursales.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="inv-sucursal">Sucursal (opcional)</Label>
              <select
                id="inv-sucursal"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <option value="">Sin sucursal asignada (compartido)</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
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

function EditarItemDialog({
  clinicId,
  item,
  currency,
  sucursales,
}: {
  clinicId: string;
  item: InventoryItem;
  currency: string;
  sucursales: Sucursal[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(item.name);
  const [unit, setUnit] = useState(item.unit);
  const [minStock, setMinStock] = useState(item.minStock == null ? "" : String(item.minStock));
  const [costPesos, setCostPesos] = useState(
    item.costCents == null ? "" : String(fromCents(item.costCents, currency)),
  );
  const [notes, setNotes] = useState(item.notes ?? "");
  const [isActive, setIsActive] = useState(item.isActive);
  const [branchId, setBranchId] = useState(item.branchId ?? "");

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
          costCents: costPesos.trim() === "" ? null : toCents(Number(costPesos), currency),
          notes: notes.trim() || undefined,
          isActive,
          branchId: sucursales.length > 1 ? branchId || null : undefined,
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
          {sucursales.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor={`ei-sucursal-${item.id}`}>Sucursal</Label>
              <select
                id={`ei-sucursal-${item.id}`}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <option value="">Sin sucursal asignada (compartido)</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
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
  const [lotNumber, setLotNumber] = useState("");
  const [expirationDate, setExpirationDate] = useState("");

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
          lotNumber: kind === "entrada" ? lotNumber.trim() || undefined : undefined,
          expirationDate: kind === "entrada" ? expirationDate || undefined : undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-movements", clinicId, item.id] });
      queryClient.invalidateQueries({ queryKey: ["inventory-expiring", clinicId] });
      toast.success("Movimiento registrado.");
      setOpen(false);
      setQuantity("");
      setReason("");
      setLotNumber("");
      setExpirationDate("");
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
          {kind === "entrada" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`mv-lote-${item.id}`}>Lote (opcional)</Label>
                <input
                  id={`mv-lote-${item.id}`}
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  className={inputClass()}
                  placeholder="Ej: L-2026-042"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`mv-venc-${item.id}`}>Vencimiento (opcional)</Label>
                <input
                  id={`mv-venc-${item.id}`}
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className={inputClass()}
                />
              </div>
            </div>
          )}
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
                  <TableHead>Lote / vence</TableHead>
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
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {m.lotNumber || m.expirationDate ? (
                        <>
                          {m.lotNumber && <span>{m.lotNumber}</span>}
                          {m.lotNumber && m.expirationDate && " · "}
                          {m.expirationDate && (
                            <span>
                              vence{" "}
                              {new Date(m.expirationDate + "T00:00:00").toLocaleDateString("es-CL")}
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
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
  const currency = access.clinic!.currency;
  const puedeGestionar = hasPermission(access.role, "inventory:manage");
  const puedeRegistrarMovimiento = access.role != null && MOVEMENT_ROLES.has(access.role);

  // product-2 (auditoría 360): filtro por sucursal. Solo tiene sentido
  // cuando la clínica tiene más de una sucursal ACTIVA — con 0-1 sucursales
  // (el caso común hoy) no se muestra ni el selector ni la columna, para no
  // agregar fricción a la UI de la mayoría de las clínicas.
  const fetchBranches = useServerFn(listBranches);
  const branchesQuery = useQuery({
    queryKey: ["branches", clinicId],
    queryFn: () => fetchBranches({ data: { clinicId } }),
  });
  const sucursales = branchesQuery.data ?? [];
  const multiSucursal = sucursales.length > 1;
  const [branchFilter, setBranchFilter] = useState("");
  const branchNameById = new Map(sucursales.map((s) => [s.id, s.nombre]));

  const fetchItems = useServerFn(listInventoryItems);
  const itemsQuery = useQuery({
    queryKey: ["inventory-items", clinicId, multiSucursal ? branchFilter : ""],
    queryFn: () =>
      fetchItems({
        data: { clinicId, branchId: multiSucursal && branchFilter ? branchFilter : undefined },
      }),
  });

  const fetchExpiring = useServerFn(listExpiringLots);
  const expiringQuery = useQuery({
    queryKey: ["inventory-expiring", clinicId],
    queryFn: () => fetchExpiring({ data: { clinicId, withinDays: 60 } }),
  });

  const items = itemsQuery.data?.items ?? [];
  const activeItems = items.filter((i) => i.isActive);
  const inactiveItems = items.filter((i) => !i.isActive);
  const lowStockCount = activeItems.filter((i) => i.belowMinStock).length;
  const expiringLots = expiringQuery.data ?? [];
  const hoyISO = new Date().toISOString().slice(0, 10);

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
          <div className="flex flex-wrap items-center gap-2">
            {multiSucursal && (
              <label className="block">
                <span className="sr-only">Sucursal</span>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  aria-label="Filtrar por sucursal"
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <option value="">Todas las sucursales</option>
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {puedeGestionar && (
              <CrearItemDialog clinicId={clinicId} currency={currency} sucursales={sucursales} />
            )}
          </div>
        </div>

        {expiringLots.length > 0 && (
          <section className="rounded-2xl border border-warning/30 bg-warning/5 p-5">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-warning">
              <AlertTriangle className="size-4" /> Lotes próximos a vencer (60 días)
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              {expiringLots.map((lot) => {
                const vencido = lot.expirationDate < hoyISO;
                return (
                  <li
                    key={lot.movementId}
                    className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline/60 pt-1.5 first:border-t-0 first:pt-0"
                  >
                    <span>
                      <span className="font-medium">{lot.itemName}</span>
                      {lot.lotNumber && (
                        <span className="text-muted-foreground"> · lote {lot.lotNumber}</span>
                      )}
                      <span className="text-muted-foreground">
                        {" "}
                        · {lot.quantity} {lot.unit}
                      </span>
                    </span>
                    <Badge variant={vencido ? "destructive" : "secondary"}>
                      {vencido ? "Vencido" : "Vence"}{" "}
                      {new Date(lot.expirationDate + "T00:00:00").toLocaleDateString("es-CL")}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

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
                  {multiSucursal && <TableHead>Sucursal</TableHead>}
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
                      {item.costCents == null
                        ? "Sin costo cargado"
                        : formatMoney(item.costCents, currency)}
                    </TableCell>
                    {multiSucursal && (
                      <TableCell className="text-muted-foreground">
                        {item.branchId == null
                          ? "Sin asignar"
                          : (branchNameById.get(item.branchId) ?? "Sin asignar")}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        <HistorialMovimientosDialog clinicId={clinicId} item={item} />
                        {puedeRegistrarMovimiento && (
                          <RegistrarMovimientoDialog clinicId={clinicId} item={item} />
                        )}
                        {puedeGestionar && (
                          <EditarItemDialog
                            clinicId={clinicId}
                            item={item}
                            currency={currency}
                            sucursales={sucursales}
                          />
                        )}
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
                          <EditarItemDialog
                            clinicId={clinicId}
                            item={item}
                            currency={currency}
                            sucursales={sucursales}
                          />
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
