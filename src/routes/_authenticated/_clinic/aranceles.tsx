import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Pencil, Plus, Upload } from "lucide-react";
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
import { SearchField, FilterBar, SelectField } from "@/components/filters";
import { MoneyInput } from "@/components/money-input";
import { requirePermission } from "@/lib/route-guards";
import { formatMoney, fromCents, toCents, type Procedure } from "@/lib/finance";
import { parseArancelCsv, type ArancelCsvResult } from "@/lib/arancel-csv";
import {
  createProcedure,
  importProcedures,
  listProcedures,
  setProcedureActive,
  updateProcedure,
} from "@/lib/finance.functions";
import { coincide, str } from "@/lib/search";
import { exportarCsv } from "@/lib/csv-export";
import { hoyISO } from "@/lib/clinic-data";
import { cn } from "@/lib/utils";

interface ArancelesSearch {
  q: string;
  categoria: string;
}

export const Route = createFileRoute("/_authenticated/_clinic/aranceles")({
  validateSearch: (search: Record<string, unknown>): ArancelesSearch => ({
    q: str(search.q),
    categoria: str(search.categoria),
  }),
  beforeLoad: requirePermission("settings:manage"),
  head: () => ({
    meta: [
      { title: "Arancel de precios | Alika" },
      {
        name: "description",
        content:
          "Lista de prestaciones de la clínica con precio, valor referencial, costo de laboratorio e importación desde CSV.",
      },
    ],
  }),
  component: ArancelesPage,
});

const INPUT =
  "w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

interface Draft {
  name: string;
  code: string;
  category: string;
  /** Los tres montos en cents. `MoneyInput` muestra la unidad visible. */
  price: number | null;
  referencePrice: number | null;
  labCost: number | null;
  durationMin: number | null;
  allowsDiscount: boolean;
}

const draftVacio = (): Draft => ({
  name: "",
  code: "",
  category: "",
  price: null,
  referencePrice: null,
  labCost: null,
  durationMin: null,
  allowsDiscount: true,
});

/** Campo de dinero que distingue vacío ("sin dato") de cero — regla 11. */
function MontoOpcional({
  id,
  label,
  currency,
  value,
  onChange,
  placeholder = "Sin dato",
}: {
  id: string;
  label: string;
  currency: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <MoneyInput
        id={id}
        currency={currency}
        min={0}
        valueCents={value}
        placeholder={placeholder}
        onValueChange={onChange}
      />
    </div>
  );
}

/** Campo numérico que distingue vacío (null) de cero — regla 11. */
function NumeroOpcional({
  id,
  label,
  value,
  onChange,
  placeholder = "Sin dato",
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type="number"
        min={0}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={INPUT}
      />
    </div>
  );
}

function PrestacionDialog({
  clinicId,
  currency,
  procedure,
  categorias,
}: {
  clinicId: string;
  currency: string;
  /** Sin `procedure` el diálogo crea; con él, edita. */
  procedure?: Procedure;
  categorias: string[];
}) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Draft>(() =>
    procedure
      ? {
          name: procedure.name,
          code: procedure.code ?? "",
          category: procedure.category ?? "",
          price: procedure.defaultPriceCents,
          referencePrice: procedure.referencePriceCents,
          labCost: procedure.labCostCents,
          durationMin: procedure.durationMin,
          allowsDiscount: procedure.allowsDiscount,
        }
      : draftVacio(),
  );
  const queryClient = useQueryClient();
  const createFn = useServerFn(createProcedure);
  const updateFn = useServerFn(updateProcedure);

  const patch = (cambios: Partial<Draft>) => setD((prev) => ({ ...prev, ...cambios }));

  const guardar = useMutation({
    mutationFn: () => {
      const payload = {
        clinicId,
        name: d.name.trim(),
        code: d.code.trim() || null,
        category: d.category.trim() || null,
        defaultPriceCents: d.price ?? 0,
        durationMin: d.durationMin,
        allowsDiscount: d.allowsDiscount,
        referencePriceCents: d.referencePrice,
        labCostCents: d.labCost,
        position: procedure?.position ?? 0,
      };
      // create devuelve {id} y update {ok}; acá solo importa que terminó bien.
      return procedure
        ? updateFn({ data: { ...payload, procedureId: procedure.id } }).then(() => undefined)
        : createFn({ data: payload }).then(() => undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures", clinicId] });
      toast.success(procedure ? "Prestación actualizada" : "Prestación creada");
      setOpen(false);
      if (!procedure) setD(draftVacio());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {procedure ? (
          <Button variant="ghost" size="sm">
            <Pencil className="size-3.5" /> Editar
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" /> Nueva prestación
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{procedure ? "Editar prestación" : "Nueva prestación"}</DialogTitle>
          <DialogDescription>
            El precio final es lo que se le cobra al paciente. El valor referencial es lo que
            declarás ante un convenio, si corresponde.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Nombre</Label>
            <input
              id="p-name"
              value={d.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Ej: Destartraje supragingival"
              className={INPUT}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-code">Código</Label>
              <input
                id="p-code"
                value={d.code}
                onChange={(e) => patch({ code: e.target.value })}
                placeholder="Opcional"
                className={INPUT}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-cat">Categoría</Label>
              <input
                id="p-cat"
                list="categorias-arancel"
                value={d.category}
                onChange={(e) => patch({ category: e.target.value })}
                placeholder="Ej: Odontopediatría"
                className={INPUT}
              />
              <datalist id="categorias-arancel">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-price">Precio final</Label>
              <MoneyInput
                id="p-price"
                currency={currency}
                min={0}
                valueCents={d.price}
                onValueChange={(price) => patch({ price })}
              />
            </div>
            <MontoOpcional
              id="p-ref"
              label="Valor referencial"
              currency={currency}
              value={d.referencePrice}
              onChange={(referencePrice) => patch({ referencePrice })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MontoOpcional
              id="p-lab"
              label="Costo de laboratorio"
              currency={currency}
              value={d.labCost}
              onChange={(labCost) => patch({ labCost })}
            />
            <NumeroOpcional
              id="p-dur"
              label="Duración (min)"
              value={d.durationMin}
              onChange={(durationMin) => patch({ durationMin })}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={d.allowsDiscount}
              onChange={(e) => patch({ allowsDiscount: e.target.checked })}
              className="size-4 rounded border-hairline"
            />
            Permite descuento en el presupuesto
          </label>
        </div>

        <DialogFooter>
          <Button onClick={() => guardar.mutate()} disabled={!d.name.trim() || guardar.isPending}>
            {guardar.isPending && <Loader2 className="size-3.5 animate-spin" />}
            {procedure ? "Guardar cambios" : "Crear prestación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportarCsvDialog({ clinicId, currency }: { clinicId: string; currency: string }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ArancelCsvResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const importFn = useServerFn(importProcedures);

  const importar = useMutation({
    mutationFn: () =>
      importFn({
        data: {
          clinicId,
          filas: (preview?.filas ?? []).map((f) => ({
            name: f.name,
            code: f.code || null,
            category: f.category || null,
            // El parser devuelve unidades visibles; la conversión a cents es
            // acá, con la moneda de la clínica, igual que en el diálogo.
            defaultPriceCents: toCents(f.price, currency),
            durationMin: f.durationMin,
            allowsDiscount: f.allowsDiscount,
            referencePriceCents:
              f.referencePrice == null ? null : toCents(f.referencePrice, currency),
            labCostCents: f.labCost == null ? null : toCents(f.labCost, currency),
            position: 0,
          })),
        },
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["procedures", clinicId] });
      toast.success(`${res.creadas} prestaciones nuevas, ${res.actualizadas} actualizadas`);
      setOpen(false);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPreview(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="size-4" /> Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar arancel desde CSV</DialogTitle>
          <DialogDescription>
            El archivo necesita una columna <strong>Nombre</strong>. Si además trae Código,
            Categoría, Precio, Valor referencial, Costo laboratorio o Duración, se usan. Una
            prestación que ya exista (por código, o por nombre si no hay código) se actualiza en
            lugar de duplicarse.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            aria-label="Archivo CSV del arancel"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return setPreview(null);
              setPreview(parseArancelCsv(await file.text()));
            }}
            className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
          />

          {preview && (
            <div className="space-y-2 rounded-lg border border-hairline p-3 text-xs">
              <p className="font-medium">
                {preview.filas.length} prestaciones listas para importar
              </p>
              {preview.errores.length > 0 && (
                <ul className="space-y-0.5 text-warning">
                  {preview.errores.slice(0, 5).map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                  {preview.errores.length > 5 && <li>y {preview.errores.length - 5} más…</li>}
                </ul>
              )}
              <ul className="max-h-40 space-y-0.5 overflow-y-auto text-muted-foreground">
                {preview.filas.slice(0, 8).map((f, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="truncate">
                      {f.category ? `${f.category} · ` : ""}
                      {f.name}
                    </span>
                    <span className="shrink-0 font-mono">
                      {formatMoney(toCents(f.price, currency), currency)}
                    </span>
                  </li>
                ))}
                {preview.filas.length > 8 && <li>y {preview.filas.length - 8} más…</li>}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => importar.mutate()}
            disabled={!preview?.filas.length || importar.isPending}
          >
            {importar.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Importar {preview?.filas.length ? `${preview.filas.length} prestaciones` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArancelesPage() {
  const { access } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const clinicId = access.clinic?.id;
  const currency = access.clinic?.currency ?? "CLP";
  const queryClient = useQueryClient();

  const fetchProcedures = useServerFn(listProcedures);
  const setActiveFn = useServerFn(setProcedureActive);

  const { data: procedures = [], isLoading } = useQuery({
    queryKey: ["procedures", clinicId, "todas"],
    enabled: Boolean(clinicId),
    queryFn: () => fetchProcedures({ data: { clinicId: clinicId!, incluirInactivas: true } }),
  });

  const setActive = useMutation({
    mutationFn: (v: { procedureId: string; isActive: boolean }) =>
      setActiveFn({ data: { clinicId: clinicId!, ...v } }),
    onSuccess: (_r, v) => {
      queryClient.invalidateQueries({ queryKey: ["procedures", clinicId] });
      toast.success(v.isActive ? "Prestación reactivada" : "Prestación dada de baja");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const categorias = useMemo(
    () =>
      [...new Set(procedures.map((p) => p.category).filter((c): c is string => Boolean(c)))].sort(),
    [procedures],
  );

  const filtradas = useMemo(
    () =>
      procedures.filter((p) => {
        if (search.categoria && (p.category ?? "") !== search.categoria) return false;
        if (search.q && !coincide(search.q, p.name, p.code, p.category)) return false;
        return true;
      }),
    [procedures, search.q, search.categoria],
  );

  // Agrupa por categoría para que el arancel se lea como la lista de precios
  // que es, y no como una tabla plana de 300 filas.
  const porCategoria = useMemo(() => {
    const map = new Map<string, Procedure[]>();
    for (const p of filtradas) {
      const key = p.category ?? "Sin categoría";
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtradas]);

  const set = (patch: Partial<ArancelesSearch>) =>
    navigate({ search: (prev: ArancelesSearch) => ({ ...prev, ...patch }) });

  return (
    <AppShell title="Arancel de precios" access={access}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {procedures.length} prestaciones · {procedures.filter((p) => !p.isActive).length} dadas
            de baja
          </p>
          <div className="flex flex-wrap gap-2">
            {procedures.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportarCsv<Procedure>(
                    filtradas,
                    [
                      { header: "Código", value: (p) => p.code },
                      { header: "Nombre", value: (p) => p.name },
                      { header: "Categoría", value: (p) => p.category },
                      { header: "Precio", value: (p) => p.defaultPriceCents },
                      { header: "Valor referencial", value: (p) => p.referencePriceCents },
                      { header: "Costo laboratorio", value: (p) => p.labCostCents },
                      { header: "Duración", value: (p) => p.durationMin },
                      {
                        header: "Permite descuento",
                        value: (p) => (p.allowsDiscount ? "Sí" : "No"),
                      },
                      { header: "Activa", value: (p) => (p.isActive ? "Sí" : "No") },
                    ],
                    "arancel",
                    hoyISO(access.clinic?.timezone),
                  )
                }
              >
                <Download className="size-4" /> Exportar CSV
              </Button>
            )}
            <ImportarCsvDialog clinicId={clinicId!} currency={currency} />
            <PrestacionDialog clinicId={clinicId!} currency={currency} categorias={categorias} />
          </div>
        </div>

        <FilterBar
          activos={[search.q, search.categoria].filter(Boolean).length}
          onReset={() => set({ q: "", categoria: "" })}
        >
          <SearchField
            label="Buscar"
            value={search.q}
            onChange={(q) => set({ q })}
            placeholder="Nombre o código"
          />
          <SelectField
            label="Categoría"
            value={search.categoria}
            onChange={(categoria) => set({ categoria })}
            allLabel="Todas las categorías"
            options={categorias.map((c) => ({ value: c, label: c }))}
          />
        </FilterBar>

        {isLoading && <p className="text-sm text-muted-foreground">Cargando arancel…</p>}

        {!isLoading && procedures.length === 0 && (
          <div className="card-clinical p-8 text-center">
            <p className="mb-1 font-display text-lg font-semibold">Tu arancel está vacío</p>
            <p className="mx-auto mb-4 max-w-md text-sm text-muted-foreground">
              Cargá tu lista de precios una vez y después presupuestás eligiendo de acá, sin
              escribir el nombre y el monto en cada presupuesto. Si ya la tenés en una planilla,
              importala.
            </p>
            <div className="flex justify-center gap-2">
              <ImportarCsvDialog clinicId={clinicId!} currency={currency} />
              <PrestacionDialog clinicId={clinicId!} currency={currency} categorias={categorias} />
            </div>
          </div>
        )}

        {!isLoading &&
          porCategoria.map(([categoria, items]) => (
            <section key={categoria} className="card-clinical overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-hairline bg-secondary/40 px-4 py-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {categoria}
                </h2>
                <span className="text-[11px] text-muted-foreground">{items.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] text-sm">
                  <thead>
                    <tr className="border-b border-hairline text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2 text-left font-medium">Prestación</th>
                      <th className="px-3 py-2 text-left font-medium">Código</th>
                      <th className="px-3 py-2 text-right font-medium">Precio</th>
                      <th className="px-3 py-2 text-right font-medium">V. ref.</th>
                      <th className="px-3 py-2 text-right font-medium">Lab.</th>
                      <th className="px-3 py-2 text-center font-medium">Dscto</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr
                        key={p.id}
                        className={cn(
                          "border-b border-hairline last:border-0",
                          !p.isActive && "opacity-50",
                        )}
                      >
                        <td className="px-4 py-2">
                          {p.name}
                          {!p.isActive && (
                            <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              De baja
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          {p.code ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatMoney(p.defaultPriceCents, p.currency)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {p.referencePriceCents === null
                            ? "—"
                            : formatMoney(p.referencePriceCents, p.currency)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {p.labCostCents === null ? "—" : formatMoney(p.labCostCents, p.currency)}
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                          {p.allowsDiscount ? "Sí" : "No"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <PrestacionDialog
                              clinicId={clinicId!}
                              currency={currency}
                              procedure={p}
                              categorias={categorias}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={setActive.isPending}
                              onClick={() =>
                                setActive.mutate({ procedureId: p.id, isActive: !p.isActive })
                              }
                            >
                              {p.isActive ? "Dar de baja" : "Reactivar"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

        {!isLoading && procedures.length > 0 && filtradas.length === 0 && (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">
            Ninguna prestación coincide con el filtro.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Precios en {currency}. Dar de baja no borra la prestación: los presupuestos y tratamientos
          que la usaron siguen mostrándola.
        </p>
      </div>
    </AppShell>
  );
}
