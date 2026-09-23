import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LAB_ORDER_STATUS_LABELS, type LabOrderStatus } from "@/lib/finance/finance";
import {
  getMyLabPortalOrders,
  updateLabOrderStatusFromPortal,
} from "@/lib/clinic-operations/lab-portal.functions";

export const Route = createFileRoute("/portal-laboratorio/inicio")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: LabPortalInicio,
});

const SIGUIENTE_ESTADO: Partial<Record<LabOrderStatus, { next: LabOrderStatus; label: string }>> = {
  enviado: { next: "en_proceso", label: "Marcar en proceso" },
  en_proceso: { next: "recibido", label: "Marcar entregado" },
  reprocesar: { next: "en_proceso", label: "Marcar en proceso" },
};

function LabPortalInicio() {
  const queryClient = useQueryClient();
  const fetchOrders = useServerFn(getMyLabPortalOrders);
  const updateFn = useServerFn(updateLabOrderStatusFromPortal);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["lab-portal-orders"],
    queryFn: () => fetchOrders({}),
  });

  const avanzar = useMutation({
    mutationFn: (v: { orderId: string; status: LabOrderStatus }) => updateFn({ data: v }),
    onSuccess: () => {
      toast.success("Estado actualizado.");
      queryClient.invalidateQueries({ queryKey: ["lab-portal-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center p-6">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-medium">Tu sesión venció.</p>
        <p className="text-xs text-muted-foreground">Pedile a la clínica un enlace nuevo.</p>
      </div>
    );
  }

  const pendientes = data.orders.filter((o) => o.status !== "recibido" && o.status !== "cancelado");
  const entregadas = data.orders.filter((o) => o.status === "recibido" || o.status === "cancelado");

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <header>
        <h1 className="text-xl font-semibold">{data.labName}</h1>
        <p className="text-sm text-muted-foreground">Órdenes de {data.clinicName}.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Pendientes ({pendientes.length})
        </h2>
        {pendientes.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin órdenes pendientes.</p>
        )}
        {pendientes.map((o) => {
          const accion = SIGUIENTE_ESTADO[o.status];
          return (
            <div key={o.id} className="rounded-xl border border-hairline p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{o.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.patientName}
                    {o.toothNumbers?.length ? ` · Piezas ${o.toothNumbers.join(", ")}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enviado {o.sentOn}
                    {o.dueOn ? ` · Comprometido ${o.dueOn}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                  {LAB_ORDER_STATUS_LABELS[o.status]}
                </span>
              </div>
              {accion && (
                <Button
                  className="mt-3"
                  size="sm"
                  disabled={avanzar.isPending}
                  onClick={() => avanzar.mutate({ orderId: o.id, status: accion.next })}
                >
                  {avanzar.isPending && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                  {accion.label}
                </Button>
              )}
            </div>
          );
        })}
      </section>

      {entregadas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Historial
          </h2>
          {entregadas.map((o) => (
            <div key={o.id} className="rounded-xl border border-hairline p-4 opacity-70">
              <p className="text-sm font-medium">{o.description}</p>
              <p className="text-xs text-muted-foreground">
                {o.patientName} · {LAB_ORDER_STATUS_LABELS[o.status]}
                {o.receivedOn ? ` el ${o.receivedOn}` : ""}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
