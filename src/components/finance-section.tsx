import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  FileText,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

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
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  QUOTE_STATUS_LABELS,
  TREATMENT_ITEM_STATUSES,
  TREATMENT_ITEM_STATUS_LABELS,
  TREATMENT_PLAN_STATUS_LABELS,
  formatMoney,
  type PaymentMethod,
  type Procedure,
  type QuoteStatus,
  type TreatmentItemStatus,
  type TreatmentPlan,
} from "@/lib/finance";
import {
  createProcedure,
  createQuote,
  listPayments,
  listProcedures,
  listQuotes,
  listTreatmentPlans,
  registerPayment,
  setQuoteStatus,
  setTreatmentItemStatus,
} from "@/lib/finance.functions";
import { cn } from "@/lib/utils";
import { useOfflineMutation } from "@/hooks/use-offline-mutation";

interface Props {
  clinicId: string;
  clinicaNombre: string;
  patientId: string;
  puedeEditar: boolean;
  /** Dueño de lo que quede en la cola offline (ver `offline-queue.ts`). */
  userId: string;
}

interface DraftItem {
  procedureId: string | null;
  nameSnapshot: string;
  quantity: number;
  unitPrice: number; // pesos (sin cents) — CLP no usa decimales, el resto sí. La conversión al server se hace vía toCents
  discount: number;
  notes: string;
}

const emptyItem = (): DraftItem => ({
  procedureId: null,
  nameSnapshot: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  notes: "",
});

function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const tone: Record<QuoteStatus, string> = {
    draft: "bg-secondary text-muted-foreground",
    sent: "bg-ai-soft text-ai",
    accepted: "bg-success-soft text-success",
    converted: "bg-success-soft text-success",
    rejected: "bg-destructive/10 text-destructive",
    expired: "bg-warning-soft text-warning",
  };
  return (
    <span
      className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-medium", tone[status])}
    >
      {QUOTE_STATUS_LABELS[status]}
    </span>
  );
}

function ItemStatusPicker({
  current,
  onChange,
  disabled,
}: {
  current: TreatmentItemStatus;
  onChange: (s: TreatmentItemStatus) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={current}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as TreatmentItemStatus)}
      className="rounded-md border border-hairline bg-transparent px-1.5 py-0.5 text-[10px] disabled:opacity-50"
    >
      {TREATMENT_ITEM_STATUSES.map((s) => (
        <option key={s} value={s}>
          {TREATMENT_ITEM_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

function NuevoProcedimientoInline({
  clinicId,
  onCreated,
}: {
  clinicId: string;
  onCreated: (p: Procedure) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState(0);
  const createFn = useServerFn(createProcedure);
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          clinicId,
          name: name.trim(),
          category: category.trim() || undefined,
          defaultPriceCents: price,
        },
      }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["procedures", clinicId] });
      onCreated({
        id: res.id,
        code: null,
        name: name.trim(),
        category: category.trim() || null,
        defaultPriceCents: price,
        currency: "CLP",
        durationMin: null,
        isActive: true,
      });
      setOpen(false);
      setName("");
      setCategory("");
      setPrice(0);
      toast.success("Procedimiento agregado al catálogo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
        >
          <Plus className="size-3" /> Nuevo procedimiento
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo procedimiento en el catálogo</DialogTitle>
          <DialogDescription>
            Este procedimiento queda disponible para todos los presupuestos futuros de la clínica.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="proc-name">Nombre</Label>
            <input
              id="proc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Limpieza dental"
              className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proc-cat">Categoría</Label>
              <input
                id="proc-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Preventiva"
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proc-price">Precio base (CLP)</Label>
              <input
                id="proc-price"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !name.trim()}>
            {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Guardar procedimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NuevoPresupuestoDialog({
  clinicId,
  patientId,
  procedures,
}: {
  clinicId: string;
  patientId: string;
  procedures: Procedure[];
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const queryClient = useQueryClient();
  const createFn = useServerFn(createQuote);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (s, it) => s + Math.max(0, it.quantity * it.unitPrice - it.discount),
      0,
    );
    return { subtotal, total: subtotal };
  }, [items]);

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          clinicId,
          patientId,
          notes: notes.trim() || undefined,
          items: items
            .filter((it) => it.nameSnapshot.trim())
            .map((it) => ({
              procedureId: it.procedureId ?? undefined,
              nameSnapshot: it.nameSnapshot.trim(),
              quantity: it.quantity,
              unitPriceCents: it.unitPrice,
              discountCents: it.discount,
              notes: it.notes.trim() || undefined,
            })),
        },
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["quotes", clinicId, patientId] });
      toast.success(`Presupuesto ${res.number} creado`);
      setOpen(false);
      setNotes("");
      setItems([emptyItem()]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pickProcedure = (idx: number, procId: string) => {
    const p = procedures.find((x) => x.id === procId);
    if (!p) return;
    setItems((arr) =>
      arr.map((it, i) =>
        i === idx
          ? { ...it, procedureId: p.id, nameSnapshot: p.name, unitPrice: p.defaultPriceCents }
          : it,
      ),
    );
  };

  const puedeCrear = items.some((it) => it.nameSnapshot.trim()) && !create.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Nuevo presupuesto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo presupuesto</DialogTitle>
          <DialogDescription>
            Cada ítem del presupuesto se convierte en un tratamiento del plan cuando lo aceptes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ítems
            </p>
            <NuevoProcedimientoInline
              clinicId={clinicId}
              onCreated={(p) => {
                setItems((arr) => {
                  const emptyIdx = arr.findIndex((it) => !it.nameSnapshot.trim());
                  const target = emptyIdx >= 0 ? emptyIdx : arr.length;
                  const next = [...arr];
                  if (emptyIdx < 0) next.push(emptyItem());
                  next[target] = {
                    ...next[target],
                    procedureId: p.id,
                    nameSnapshot: p.name,
                    unitPrice: p.defaultPriceCents,
                  };
                  return next;
                });
              }}
            />
          </div>

          <div className="space-y-2">
            {items.map((it, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 rounded-lg border border-hairline p-2"
              >
                <div className="min-w-0 space-y-1">
                  <select
                    value={it.procedureId ?? ""}
                    onChange={(e) =>
                      e.target.value
                        ? pickProcedure(i, e.target.value)
                        : setItems((arr) =>
                            arr.map((x, j) => (j === i ? { ...x, procedureId: null } : x)),
                          )
                    }
                    className="w-full rounded-md border border-hairline bg-transparent px-2 py-1 text-xs outline-none focus:border-brand/50"
                  >
                    <option value="">— Elegir del catálogo o escribir libre —</option>
                    {procedures.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {formatMoney(p.defaultPriceCents, p.currency)}
                      </option>
                    ))}
                  </select>
                  <input
                    value={it.nameSnapshot}
                    onChange={(e) =>
                      setItems((arr) =>
                        arr.map((x, j) => (j === i ? { ...x, nameSnapshot: e.target.value } : x)),
                      )
                    }
                    placeholder="Descripción del ítem"
                    className="w-full rounded-md border border-hairline bg-transparent px-2 py-1 text-xs outline-none focus:border-brand/50"
                  />
                </div>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={it.quantity}
                  onChange={(e) =>
                    setItems((arr) =>
                      arr.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)),
                    )
                  }
                  title="Cantidad"
                  className="w-14 rounded-md border border-hairline bg-transparent px-2 py-1 text-xs outline-none focus:border-brand/50"
                />
                <input
                  type="number"
                  min={0}
                  value={it.unitPrice}
                  onChange={(e) =>
                    setItems((arr) =>
                      arr.map((x, j) =>
                        j === i ? { ...x, unitPrice: Number(e.target.value) } : x,
                      ),
                    )
                  }
                  title="Precio unitario (CLP)"
                  className="w-24 rounded-md border border-hairline bg-transparent px-2 py-1 text-xs outline-none focus:border-brand/50"
                />
                <input
                  type="number"
                  min={0}
                  value={it.discount}
                  onChange={(e) =>
                    setItems((arr) =>
                      arr.map((x, j) => (j === i ? { ...x, discount: Number(e.target.value) } : x)),
                    )
                  }
                  title="Descuento (CLP)"
                  placeholder="Desc."
                  className="w-20 rounded-md border border-hairline bg-transparent px-2 py-1 text-xs outline-none focus:border-brand/50"
                />
                <button
                  onClick={() => setItems((arr) => arr.filter((_, j) => j !== i))}
                  disabled={items.length === 1}
                  aria-label="Quitar"
                  className="rounded-md p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setItems((arr) => [...arr, emptyItem()])}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline"
          >
            <Plus className="size-3" /> Agregar otro ítem
          </button>

          <div className="space-y-1.5">
            <Label htmlFor="q-notes">Notas</Label>
            <textarea
              id="q-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              placeholder="Observaciones o condiciones del presupuesto"
            />
          </div>

          <div className="flex items-center justify-end gap-4 border-t border-hairline pt-3 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-display text-lg font-semibold">{formatMoney(totals.total)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!puedeCrear}>
            {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Crear presupuesto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NuevoPagoDialog({
  clinicId,
  patientId,
  userId,
  plans,
  suggestedAmountCents,
  currency,
}: {
  clinicId: string;
  patientId: string;
  userId: string;
  plans: TreatmentPlan[];
  suggestedAmountCents: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(suggestedAmountCents);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [planId, setPlanId] = useState<string>("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const payFn = useServerFn(registerPayment);

  const create = useOfflineMutation({
    kind: "registrar-pago",
    userId,
    ejecutar: (payload) => payFn({ data: payload }),
    invalidar: [
      ["payments", clinicId, patientId],
      ["patient", clinicId, patientId],
      ["patients", clinicId],
    ],
    resumen: (p) => `Cobro de ${formatMoney(p.amountCents as number, currency)}`,
    onDone: () => {
      setOpen(false);
      setAmount(0);
      setMethod("cash");
      setPlanId("");
      setReference("");
      setNotes("");
    },
  });

  function guardar() {
    void create.mutar({
      // El id lo genera el equipo, no la base: si esto se captura sin
      // conexión y el reintento llega dos veces, el segundo choca contra la
      // PK y el servidor lo reconoce como el mismo cobro (no cobra doble).
      id: crypto.randomUUID(),
      clinicId,
      patientId,
      amountCents: amount,
      method,
      // ⚠️ Sellado en la CAPTURA. Sin esto, un cobro tomado a las 10:00 que
      // sincroniza a las 15:00 entraría con la hora del servidor y el cierre
      // de caja del día quedaría mal.
      paidAt: new Date().toISOString(),
      treatmentPlanId: planId || undefined,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setAmount(suggestedAmountCents);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CircleDollarSign className="size-4" /> Registrar pago
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            El saldo del paciente se recalcula automáticamente al guardar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Monto (CLP)</Label>
              <input
                id="pay-amount"
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-method">Método</Label>
              <select
                id="pay-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-plan">Aplicar a</Label>
            <select
              id="pay-plan"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
            >
              <option value="">A cuenta (sin asignar a un plan)</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatMoney(p.totalCents, p.currency)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-ref">Referencia (opcional)</Label>
            <input
              id="pay-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Nº de transacción, comprobante…"
              className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-notes">Notas</Label>
            <textarea
              id="pay-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={guardar} disabled={create.enCurso || amount <= 0}>
            {create.enCurso && <Loader2 className="size-3.5 animate-spin" />}
            Guardar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FinanceSection({ clinicId, clinicaNombre, patientId, puedeEditar, userId }: Props) {
  const queryClient = useQueryClient();
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const fetchQuotes = useServerFn(listQuotes);
  const fetchPlans = useServerFn(listTreatmentPlans);
  const fetchProcedures = useServerFn(listProcedures);
  const fetchPayments = useServerFn(listPayments);
  const setStatusFn = useServerFn(setQuoteStatus);
  const setItemFn = useServerFn(setTreatmentItemStatus);

  const { data: quotes = [], isLoading: qLoading } = useQuery({
    queryKey: ["quotes", clinicId, patientId],
    queryFn: () => fetchQuotes({ data: { clinicId, patientId } }),
  });
  const { data: plans = [], isLoading: pLoading } = useQuery({
    queryKey: ["treatment-plans", clinicId, patientId],
    queryFn: () => fetchPlans({ data: { clinicId, patientId } }),
  });
  const { data: procedures = [] } = useQuery({
    queryKey: ["procedures", clinicId],
    queryFn: () => fetchProcedures({ data: { clinicId } }),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments", clinicId, patientId],
    queryFn: () => fetchPayments({ data: { clinicId, patientId } }),
  });

  // Resumen de saldo calculado client-side desde plans + payments — tiene que
  // coincidir con el saldo del header (calculado server-side en getPatient).
  // Los planes cancelados no cuentan en la deuda comprometida (misma regla en
  // ambos lados).
  const planesActivos = plans.filter((p) => p.status !== "cancelled");
  const totalBilled = planesActivos.reduce(
    (s, p) => s + p.items.reduce((si, it) => si + it.priceCents, 0),
    0,
  );
  const totalPaid = payments.reduce((s, p) => s + p.amountCents, 0);
  const balance = totalBilled - totalPaid;
  const currency = planesActivos[0]?.currency ?? payments[0]?.currency ?? "CLP";

  const accept = useMutation({
    mutationFn: (quoteId: string) => setStatusFn({ data: { quoteId, status: "accepted" } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quotes", clinicId, patientId] });
      await queryClient.invalidateQueries({ queryKey: ["treatment-plans", clinicId, patientId] });
      toast.success("Presupuesto aceptado y convertido en plan de tratamiento");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: (quoteId: string) => setStatusFn({ data: { quoteId, status: "rejected" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quotes", clinicId, patientId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const setItem = useMutation({
    mutationFn: (v: { itemId: string; status: TreatmentItemStatus }) => setItemFn({ data: v }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["treatment-plans", clinicId, patientId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const isLoading = qLoading || pLoading;

  return (
    <div className="card-clinical p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Presupuestos y tratamientos</h3>
          <p className="text-xs text-muted-foreground">
            Aceptar un presupuesto crea automáticamente el plan de tratamiento con sus ítems.
          </p>
        </div>
        {puedeEditar && (
          <div className="flex flex-wrap items-center gap-2">
            <NuevoPagoDialog
              clinicId={clinicId}
              patientId={patientId}
              userId={userId}
              plans={plans}
              suggestedAmountCents={Math.max(0, balance)}
              currency={currency}
            />
            <NuevoPresupuestoDialog
              clinicId={clinicId}
              patientId={patientId}
              procedures={procedures}
            />
          </div>
        )}
      </div>

      {(totalBilled > 0 || totalPaid > 0) && (
        <div className="mb-5 grid gap-3 rounded-lg border border-hairline bg-secondary/40 p-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Facturado</p>
            <p className="font-display text-base font-semibold">
              {formatMoney(totalBilled, currency)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pagado</p>
            <p className="font-display text-base font-semibold">
              {formatMoney(totalPaid, currency)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {balance > 0 ? "Saldo pendiente" : balance < 0 ? "A favor del paciente" : "Saldo"}
            </p>
            <p
              className={cn(
                "font-display text-base font-semibold",
                balance > 0 && "text-warning",
                balance < 0 && "text-success",
              )}
            >
              {balance === 0 ? "Al día" : formatMoney(Math.abs(balance), currency)}
            </p>
          </div>
        </div>
      )}

      {isLoading && <p className="text-xs text-muted-foreground">Cargando…</p>}

      {!isLoading && (
        <div className="space-y-6">
          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Planes de tratamiento
            </p>
            {plans.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aún no hay planes de tratamiento activos.
              </p>
            )}
            {plans.map((plan) => {
              const done = plan.items.filter((it) => it.status === "completed").length;
              const isOpen = expandedPlan === plan.id;
              return (
                <div key={plan.id} className="mb-3 rounded-lg border border-hairline">
                  <button
                    onClick={() => setExpandedPlan(isOpen ? null : plan.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="size-4 text-brand" />
                      <div>
                        <p className="text-sm font-medium">{plan.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {TREATMENT_PLAN_STATUS_LABELS[plan.status]} · {done}/{plan.items.length}{" "}
                          ítems completados
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-sm font-semibold">
                        {formatMoney(plan.totalCents, plan.currency)}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="divide-y divide-hairline border-t border-hairline">
                      {plan.items.map((it) => (
                        <div key={it.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                          <span className="w-8 text-center font-mono text-muted-foreground">
                            {it.position + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{it.nameSnapshot}</span>
                          {it.toothNumber && (
                            <span className="text-muted-foreground">Pieza {it.toothNumber}</span>
                          )}
                          <span className="font-mono text-muted-foreground">
                            {formatMoney(it.priceCents, plan.currency)}
                          </span>
                          <ItemStatusPicker
                            current={it.status}
                            disabled={!puedeEditar}
                            onChange={(s) => setItem.mutate({ itemId: it.id, status: s })}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Presupuestos
            </p>
            {quotes.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin presupuestos registrados todavía.</p>
            )}
            {quotes.map((quote) => {
              const isOpen = expandedQuote === quote.id;
              const canAccept =
                puedeEditar && (quote.status === "draft" || quote.status === "sent");
              return (
                <div key={quote.id} className="mb-3 rounded-lg border border-hairline">
                  <button
                    onClick={() => setExpandedQuote(isOpen ? null : quote.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="size-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{quote.number}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(quote.createdAt).toLocaleDateString("es-CL")} ·{" "}
                          {quote.items.length} ítems
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <QuoteStatusBadge status={quote.status} />
                      <span className="font-display text-sm font-semibold">
                        {formatMoney(quote.totalCents, quote.currency)}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </div>
                  </button>
                  {isOpen && (
                    <>
                      <div className="divide-y divide-hairline border-t border-hairline">
                        {quote.items.map((it) => (
                          <div
                            key={it.id}
                            className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 px-4 py-2 text-xs"
                          >
                            <span className="w-6 text-center font-mono text-muted-foreground">
                              {it.position + 1}
                            </span>
                            <span className="min-w-0 truncate">{it.nameSnapshot}</span>
                            <span className="text-muted-foreground">×{it.quantity}</span>
                            <span className="font-mono text-muted-foreground">
                              {formatMoney(it.unitPriceCents, quote.currency)}
                            </span>
                            <span className="font-mono font-medium">
                              {formatMoney(it.totalCents, quote.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-4 py-2">
                        {canAccept && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => accept.mutate(quote.id)}
                              disabled={accept.isPending}
                            >
                              <Check className="size-3.5" /> Aceptar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => reject.mutate(quote.id)}
                              disabled={reject.isPending}
                            >
                              <X className="size-3.5" /> Rechazar
                            </Button>
                          </>
                        )}
                        <div className="ml-auto">
                          <WhatsAppButton
                            clinicId={clinicId}
                            patientId={patientId}
                            quoteId={quote.id}
                            templateKind="quote_sent"
                            variant="full"
                            label="Enviar por WhatsApp"
                            variables={{
                              numero_presupuesto: quote.number,
                              total: formatMoney(quote.totalCents, quote.currency),
                              clinica: clinicaNombre,
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </section>

          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pagos registrados
            </p>
            {payments.length === 0 && (
              <p className="text-xs text-muted-foreground">Aún no hay pagos registrados.</p>
            )}
            {payments.map((pay) => {
              const plan = plans.find((p) => p.id === pay.treatmentPlanId);
              return (
                <div
                  key={pay.id}
                  className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-hairline px-4 py-2 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <CircleDollarSign className="size-4 text-success" />
                    <div>
                      <p className="text-sm font-medium">
                        {formatMoney(pay.amountCents, pay.currency)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[pay.method]}
                        {plan && ` · ${plan.name}`}
                        {!plan && pay.treatmentPlanId === null && " · A cuenta"}
                        {pay.reference && ` · Ref. ${pay.reference}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-muted-foreground">
                    {new Date(pay.paidAt).toLocaleString("es-CL", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              );
            })}
          </section>
        </div>
      )}
    </div>
  );
}
