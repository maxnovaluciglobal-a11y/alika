import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, LockOpen, Loader2 } from "lucide-react";
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
import { MoneyInput } from "@/components/money-input";
import { requirePermission } from "@/lib/access/route-guards";
import { formatoFecha } from "@/lib/clinic-operations/clinic-data";
import { formatMoney } from "@/lib/finance/finance";
import { CASH_REGISTER_STATUS_LABELS, type CashRegister } from "@/lib/finance/cash-registers";
import {
  closeCashRegister,
  getCashRegisterBreakdown,
  getOpenCashRegister,
  listCashRegisters,
  openCashRegister,
} from "@/lib/finance/cash-registers.functions";

export const Route = createFileRoute("/_authenticated/_clinic/cajas")({
  beforeLoad: requirePermission("cash:manage"),
  head: () => ({
    meta: [
      { title: "Cajas | Alika" },
      {
        name: "description",
        content: "Apertura, cierre y arqueo de caja por turno.",
      },
    ],
  }),
  component: CajasPage,
});

const INPUT =
  "w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function CajasPage() {
  const { access } = Route.useRouteContext();
  const clinicId = access.clinic?.id;
  const currency = access.clinic?.currency ?? "CLP";
  const queryClient = useQueryClient();

  const fetchOpen = useServerFn(getOpenCashRegister);
  const fetchHistory = useServerFn(listCashRegisters);
  const fetchBreakdown = useServerFn(getCashRegisterBreakdown);
  const openFn = useServerFn(openCashRegister);
  const closeFn = useServerFn(closeCashRegister);

  const openQueryKey = ["open-cash-register", clinicId] as const;
  const historyQueryKey = ["cash-registers", clinicId] as const;

  const { data: openRegister, isLoading: loadingOpen } = useQuery({
    queryKey: openQueryKey,
    queryFn: () => fetchOpen({ data: { clinicId: clinicId!, branchId: null } }),
    enabled: !!clinicId,
  });

  const { data: history } = useQuery({
    queryKey: historyQueryKey,
    queryFn: () => fetchHistory({ data: { clinicId: clinicId!, limit: 30 } }),
    enabled: !!clinicId,
  });

  const [selectedForBreakdown, setSelectedForBreakdown] = useState<string | null>(null);
  const { data: breakdown } = useQuery({
    queryKey: ["cash-register-breakdown", selectedForBreakdown],
    queryFn: () => fetchBreakdown({ data: { cashRegisterId: selectedForBreakdown! } }),
    enabled: !!selectedForBreakdown,
  });

  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState<number | null>(0);
  const [openingNotes, setOpeningNotes] = useState("");

  const openMutation = useMutation({
    mutationFn: () =>
      openFn({
        data: {
          clinicId: clinicId!,
          branchId: null,
          openingAmountCents: openingAmount ?? 0,
          notes: openingNotes.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Caja abierta.");
      setOpenDialogOpen(false);
      setOpeningAmount(0);
      setOpeningNotes("");
      queryClient.invalidateQueries({ queryKey: openQueryKey });
      queryClient.invalidateQueries({ queryKey: historyQueryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [declaredAmount, setDeclaredAmount] = useState<number | null>(0);
  const [closingNotes, setClosingNotes] = useState("");

  const closeMutation = useMutation({
    mutationFn: () =>
      closeFn({
        data: {
          id: openRegister!.id,
          clinicId: clinicId!,
          declaredClosingCents: declaredAmount ?? 0,
          notes: closingNotes.trim() || undefined,
        },
      }),
    onSuccess: ({ differenceCents }) => {
      if (differenceCents === 0) {
        toast.success("Caja cerrada. Cuadró exacto.");
      } else if (differenceCents > 0) {
        toast.warning(`Caja cerrada. Sobran ${formatMoney(differenceCents, currency)}.`);
      } else {
        toast.warning(`Caja cerrada. Faltan ${formatMoney(-differenceCents, currency)}.`);
      }
      setCloseDialogOpen(false);
      setDeclaredAmount(0);
      setClosingNotes("");
      queryClient.invalidateQueries({ queryKey: openQueryKey });
      queryClient.invalidateQueries({ queryKey: historyQueryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!clinicId) return null;

  return (
    <AppShell title="Cajas" access={access}>
      <div className="mx-auto max-w-4xl space-y-8 p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Cajas</h1>
          <p className="text-sm text-muted-foreground">
            Apertura, cierre y arqueo por turno. Los cobros registrados mientras la caja está
            abierta se suman solos al esperado del cierre.
          </p>
        </header>

        <section className="rounded-xl border border-hairline p-5">
          {loadingOpen ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Revisando estado de caja…
            </div>
          ) : openRegister ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <LockOpen className="h-5 w-5 text-emerald-600" />
                <span className="font-medium">Caja abierta</span>
                <span className="text-sm text-muted-foreground">
                  desde {formatoFecha(openRegister.openedAt)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Monto de apertura: {formatMoney(openRegister.openingAmountCents, currency)}
                {openRegister.openingNotes ? ` — ${openRegister.openingNotes}` : ""}
              </p>
              <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default">Cerrar caja (arqueo)</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cerrar caja</DialogTitle>
                    <DialogDescription>
                      Contá lo que hay en caja y anotá el total. El sistema calcula solo la
                      diferencia contra lo esperado (apertura + cobros del turno).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Monto contado</Label>
                      <MoneyInput
                        valueCents={declaredAmount}
                        onValueChange={setDeclaredAmount}
                        currency={currency}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notas (opcional)</Label>
                      <textarea
                        className={INPUT}
                        rows={3}
                        value={closingNotes}
                        onChange={(e) => setClosingNotes(e.target.value)}
                        placeholder="Ej: faltante por vuelto mal dado en la mañana"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => closeMutation.mutate()}
                      disabled={closeMutation.isPending || declaredAmount === null}
                    >
                      {closeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirmar cierre
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">No hay caja abierta</span>
              </div>
              <Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
                <DialogTrigger asChild>
                  <Button>Abrir caja</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Abrir caja</DialogTitle>
                    <DialogDescription>
                      Registrá con cuánto empieza el turno. Los cobros de hoy se van sumando solos.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Monto inicial</Label>
                      <MoneyInput
                        valueCents={openingAmount}
                        onValueChange={setOpeningAmount}
                        currency={currency}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notas (opcional)</Label>
                      <textarea
                        className={INPUT}
                        rows={2}
                        value={openingNotes}
                        onChange={(e) => setOpeningNotes(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => openMutation.mutate()}
                      disabled={openMutation.isPending || openingAmount === null}
                    >
                      {openMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Abrir
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Historial</h2>
          <div className="overflow-x-auto rounded-xl border border-hairline">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Estado</th>
                  <th className="px-4 py-2">Apertura</th>
                  <th className="px-4 py-2">Cierre</th>
                  <th className="px-4 py-2">Apertura ($)</th>
                  <th className="px-4 py-2">Esperado</th>
                  <th className="px-4 py-2">Contado</th>
                  <th className="px-4 py-2">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {(history ?? []).map((r: CashRegister) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-t border-hairline hover:bg-muted/30"
                    onClick={() => setSelectedForBreakdown(r.id)}
                  >
                    <td className="px-4 py-2">{CASH_REGISTER_STATUS_LABELS[r.status]}</td>
                    <td className="px-4 py-2">{formatoFecha(r.openedAt)}</td>
                    <td className="px-4 py-2">{r.closedAt ? formatoFecha(r.closedAt) : "—"}</td>
                    <td className="px-4 py-2">{formatMoney(r.openingAmountCents, r.currency)}</td>
                    <td className="px-4 py-2">
                      {r.expectedClosingCents !== null
                        ? formatMoney(r.expectedClosingCents, r.currency)
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {r.declaredClosingCents !== null
                        ? formatMoney(r.declaredClosingCents, r.currency)
                        : "—"}
                    </td>
                    <td
                      className={`px-4 py-2 font-medium ${
                        r.differenceCents === null
                          ? ""
                          : r.differenceCents === 0
                            ? "text-emerald-600"
                            : "text-destructive"
                      }`}
                    >
                      {r.differenceCents !== null
                        ? formatMoney(r.differenceCents, r.currency)
                        : "—"}
                    </td>
                  </tr>
                ))}
                {(history ?? []).length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={7}>
                      Sin cajas registradas todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <Dialog
          open={!!selectedForBreakdown}
          onOpenChange={(o) => !o && setSelectedForBreakdown(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Desglose por medio de pago</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {(breakdown ?? []).map((b) => (
                <div key={b.method} className="flex justify-between text-sm">
                  <span>
                    {b.method} ({b.count})
                  </span>
                  <span className="font-medium">{formatMoney(b.amountCents, currency)}</span>
                </div>
              ))}
              {(breakdown ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Sin cobros vinculados a esta caja.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
