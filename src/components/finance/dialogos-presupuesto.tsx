import { useEffect, useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2 } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/signature-pad";
import { listProcedureSupplies } from "@/lib/clinic-operations/procedure-supplies.functions";

export function AceptarPresupuestoDialog({
  defaultName,
  pending,
  onConfirm,
}: {
  defaultName: string;
  pending: boolean;
  onConfirm: (acceptedByName: string | undefined, signatureDataUrl: string | undefined) => void;
}) {
  const fid = useId();
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState(defaultName);
  const [firma, setFirma] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={pending}>
          <Check className="size-3.5" /> Aceptar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aceptar presupuesto</DialogTitle>
          <DialogDescription>
            Al aceptar se crea el plan de tratamiento. La firma del paciente es opcional pero queda
            como evidencia del consentimiento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${fid}-nombre`}>Nombre de quien aprueba (opcional)</Label>
            <input
              id={`${fid}-nombre`}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              placeholder="Nombre del paciente o responsable"
            />
          </div>
          <SignaturePad label="Firma del paciente (opcional)" onChange={setFirma} />
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              onConfirm(nombre.trim() || undefined, firma ?? undefined);
              setOpen(false);
            }}
            disabled={pending}
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Confirmar aceptación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Tanda 2 — receta de insumos: se abre solo cuando el procedimiento tiene
 * al menos un insumo `variable` (el padre ya filtró eso, ver FinanceSection).
 * Colapsado por default — un clic en "Confirmar" alcanza para el camino
 * feliz, "Ajustar cantidades" expande el detalle editable. Nunca bloquea:
 * "Cancelar" deja el ítem en su estado anterior sin tocar nada. */
export function ConfirmarConsumoDialog({
  clinicId,
  pending,
  onClose,
  onConfirm,
  confirming,
}: {
  clinicId: string;
  pending: { itemId: string; procedureId: string; nombreItem: string };
  onClose: () => void;
  onConfirm: (overrides: Record<string, number>) => void;
  confirming: boolean;
}) {
  const fetchSupplies = useServerFn(listProcedureSupplies);
  const { data, isPending } = useQuery({
    queryKey: ["procedure-supplies", clinicId, pending.procedureId],
    queryFn: () => fetchSupplies({ data: { clinicId, procedureId: pending.procedureId } }),
  });

  const variables = useMemo(
    () => (data?.supplies ?? []).filter((s) => s.consumptionType === "variable"),
    [data],
  );
  const [expanded, setExpanded] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    setQuantities(Object.fromEntries(variables.map((s) => [s.itemId, s.adjustedQuantity])));
  }, [variables]);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Completar &ldquo;{pending.nombreItem}&rdquo;</DialogTitle>
          <DialogDescription>
            {isPending
              ? "Revisando la receta de insumos…"
              : `Se van a descontar ${variables.length} insumo${variables.length === 1 ? "" : "s"} fraccionable${variables.length === 1 ? "" : "s"} del inventario, más los de uso único de la receta.`}
          </DialogDescription>
        </DialogHeader>

        {!isPending && variables.length > 0 && (
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {expanded ? "Ocultar cantidades" : "Ajustar cantidades"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {variables.map((s) => (
                <div key={s.itemId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{s.itemName}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      aria-label={`Cantidad de ${s.itemName}`}
                      type="number"
                      min={0}
                      step="any"
                      value={quantities[s.itemId] ?? s.adjustedQuantity}
                      onChange={(e) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [s.itemId]: Number(e.target.value),
                        }))
                      }
                      className="w-20 rounded-md border border-hairline bg-transparent px-2 py-1 text-right text-sm"
                    />
                    <span className="text-xs text-muted-foreground">{s.unit}</span>
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={confirming}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(quantities)} disabled={isPending || confirming}>
            {confirming && <Loader2 className="size-3.5 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
