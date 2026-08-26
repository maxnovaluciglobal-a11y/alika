import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSignature, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "sonner";

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
  listConsentTemplates,
  listPatientConsents,
  revokePatientConsent,
  signPatientConsent,
} from "@/lib/clinical-documents.functions";

function inputClass() {
  return "w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50";
}

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);

  function ctx() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const c = ctx();
    if (!c) return;
    const { x, y } = pointerPos(e);
    c.beginPath();
    c.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const c = ctx();
    if (!c) return;
    const { x, y } = pointerPos(e);
    c.lineWidth = 2;
    c.lineCap = "round";
    c.strokeStyle = "#16211D";
    c.lineTo(x, y);
    c.stroke();
    hasStroke.current = true;
    onChange(canvasRef.current!.toDataURL("image/png"));
  }

  function end() {
    drawing.current = false;
  }

  function limpiar() {
    const c = ctx();
    const canvas = canvasRef.current;
    if (!c || !canvas) return;
    c.clearRect(0, 0, canvas.width, canvas.height);
    hasStroke.current = false;
    onChange(null);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>Firma</Label>
        <button
          type="button"
          onClick={limpiar}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Limpiar
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={460}
        height={160}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full touch-none rounded-lg border border-hairline bg-secondary/20"
      />
      <p className="text-[11px] text-muted-foreground">Firmá con el dedo o el mouse.</p>
    </div>
  );
}

export function PatientConsentsCard({
  clinicId,
  patientId,
  patientName,
  puedeEditar,
  puedeGestionar,
}: {
  clinicId: string;
  patientId: string;
  patientName: string;
  puedeEditar: boolean;
  puedeGestionar: boolean;
}) {
  const queryClient = useQueryClient();
  const fetchTemplates = useServerFn(listConsentTemplates);
  const fetchConsents = useServerFn(listPatientConsents);
  const doSign = useServerFn(signPatientConsent);
  const doRevoke = useServerFn(revokePatientConsent);

  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [signedByName, setSignedByName] = useState(patientName);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const templatesQuery = useQuery({
    queryKey: ["consent-templates", clinicId],
    queryFn: () => fetchTemplates({ data: { clinicId } }),
    enabled: open,
  });

  const consentsQueryKey = ["patient-consents", clinicId, patientId];
  const consentsQuery = useQuery({
    queryKey: consentsQueryKey,
    queryFn: () => fetchConsents({ data: { clinicId, patientId } }),
  });

  const signMutation = useMutation({
    mutationFn: () =>
      doSign({
        data: {
          clinicId,
          patientId,
          templateId: templateId || undefined,
          titleSnapshot: title,
          bodySnapshot: body,
          signedByName,
          signatureDataUrl: signatureDataUrl!,
        },
      }),
    onSuccess: () => {
      toast.success("Consentimiento firmado y guardado.");
      queryClient.invalidateQueries({ queryKey: consentsQueryKey });
      setOpen(false);
      setTemplateId("");
      setTitle("");
      setBody("");
      setSignatureDataUrl(null);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la firma."),
  });

  const revokeMutation = useMutation({
    mutationFn: (consentId: string) => doRevoke({ data: { clinicId, consentId } }),
    onSuccess: () => {
      toast.success("Consentimiento revocado.");
      queryClient.invalidateQueries({ queryKey: consentsQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo revocar."),
  });

  function aplicarTemplate(id: string) {
    setTemplateId(id);
    const template = templatesQuery.data?.find((t) => t.id === id);
    if (template) {
      setTitle(template.title);
      setBody(template.body);
    }
  }

  const consents = consentsQuery.data ?? [];

  return (
    <div className="card-clinical p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Consentimientos</h3>
          <p className="text-xs text-muted-foreground">
            Firma capturada en el momento, con el texto exacto que firmó el paciente.
          </p>
        </div>
        {puedeEditar && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <FileSignature className="size-3.5" /> Nuevo consentimiento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Firmar consentimiento</DialogTitle>
                <DialogDescription>
                  El paciente firma en esta pantalla. El texto queda guardado tal como se muestra
                  acá, aunque la plantilla cambie después.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {templatesQuery.data && templatesQuery.data.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Plantilla (opcional)</Label>
                    <select
                      value={templateId}
                      onChange={(e) => aplicarTemplate(e.target.value)}
                      className={inputClass()}
                    >
                      <option value="">Redactar desde cero</option>
                      {templatesQuery.data
                        .filter((t) => t.active)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputClass()}
                    placeholder="Ej. Consentimiento para extracción"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Texto del consentimiento</Label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={5}
                    className={inputClass()}
                    placeholder="Explicá el procedimiento, riesgos y alternativas…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Firma a nombre de</Label>
                  <input
                    value={signedByName}
                    onChange={(e) => setSignedByName(e.target.value)}
                    className={inputClass()}
                  />
                </div>
                <SignaturePad onChange={setSignatureDataUrl} />
              </div>
              <DialogFooter>
                <Button
                  onClick={() => signMutation.mutate()}
                  disabled={
                    signMutation.isPending ||
                    !title.trim() ||
                    body.trim().length < 10 ||
                    !signedByName.trim() ||
                    !signatureDataUrl
                  }
                >
                  {signMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Guardar firma
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {consentsQuery.isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : consents.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin consentimientos firmados todavía.</p>
      ) : (
        <div className="space-y-2">
          {consents.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-hairline p-3"
            >
              <div className="flex items-start gap-3">
                {c.signatureUrl && (
                  <img
                    src={c.signatureUrl}
                    alt="Firma"
                    className="h-10 w-20 rounded border border-hairline bg-white object-contain"
                  />
                )}
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {c.revokedAt ? (
                      <ShieldX className="size-3.5 text-destructive" />
                    ) : (
                      <ShieldCheck className="size-3.5 text-success" />
                    )}
                    {c.titleSnapshot}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Firmado por {c.signedByName} · {formatFechaHora(c.signedAt)}
                    {c.revokedAt && ` · Revocado ${formatFechaHora(c.revokedAt)}`}
                  </p>
                </div>
              </div>
              {puedeGestionar && !c.revokedAt && (
                <button
                  type="button"
                  onClick={() => revokeMutation.mutate(c.id)}
                  className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                >
                  Revocar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
