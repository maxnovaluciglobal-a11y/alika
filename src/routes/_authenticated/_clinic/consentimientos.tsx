import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSignature, Loader2, Plus } from "lucide-react";
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
  createConsentTemplate,
  listConsentTemplates,
  setConsentTemplateActive,
} from "@/lib/clinical-documents.functions";
import { requirePermission } from "@/lib/route-guards";

function inputClass() {
  return "w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50";
}

export const Route = createFileRoute("/_authenticated/_clinic/consentimientos")({
  beforeLoad: requirePermission("settings:manage"),
  head: () => ({
    meta: [
      { title: "Plantillas de consentimiento | Alika" },
      {
        name: "description",
        content: "Textos reutilizables para consentimientos informados que el paciente firma.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConsentimientosPage,
});

function NuevaPlantillaDialog({ clinicId }: { clinicId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const queryClient = useQueryClient();
  const createFn = useServerFn(createConsentTemplate);

  const crear = useMutation({
    mutationFn: () => createFn({ data: { clinicId, title, body } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consent-templates-admin", clinicId] });
      toast.success("Plantilla creada.");
      setOpen(false);
      setTitle("");
      setBody("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Nueva plantilla
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva plantilla de consentimiento</DialogTitle>
          <DialogDescription>
            El texto queda disponible al firmar en la ficha del paciente. Editar la plantilla
            después no cambia lo que ya se firmó.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass()}
              placeholder="Ej. Consentimiento para extracción dental"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Texto</Label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className={inputClass()}
              placeholder="Explicá el procedimiento, riesgos, alternativas y beneficios…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => crear.mutate()}
            disabled={crear.isPending || title.trim().length < 2 || body.trim().length < 10}
          >
            {crear.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Guardar plantilla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConsentimientosPage() {
  const { access } = Route.useRouteContext();
  const clinicId = access.clinic?.id;
  const fetchTemplates = useServerFn(listConsentTemplates);
  const toggleActive = useServerFn(setConsentTemplateActive);
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: ["consent-templates-admin", clinicId],
    queryFn: () => fetchTemplates({ data: { clinicId: clinicId! } }),
    enabled: Boolean(clinicId),
  });

  const toggleMutation = useMutation({
    mutationFn: (params: { templateId: string; active: boolean }) =>
      toggleActive({ data: { clinicId: clinicId!, ...params } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["consent-templates-admin", clinicId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!clinicId) {
    return (
      <AppShell title="Plantillas de consentimiento" access={access}>
        <p className="text-muted-foreground">Necesitas una clínica activa.</p>
      </AppShell>
    );
  }

  const templates = templatesQuery.data ?? [];

  return (
    <AppShell title="Plantillas de consentimiento" access={access}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            Plantillas de {access.clinic?.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {templates.length} plantilla{templates.length === 1 ? "" : "s"}. Se firman desde la
            ficha de cada paciente.
          </p>
        </div>
        <NuevaPlantillaDialog clinicId={clinicId} />
      </div>

      {templatesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : templates.length === 0 ? (
        <div className="card-clinical p-8 text-center text-sm text-muted-foreground">
          <FileSignature className="mx-auto mb-3 size-6" />
          Todavía no hay plantillas. Podés firmar consentimientos redactando el texto en el momento
          desde la ficha del paciente, o crear una plantilla acá para reusar.
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="card-clinical flex items-start justify-between gap-4 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{t.title}</h3>
                  <Badge variant={t.active ? "default" : "secondary"}>
                    {t.active ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.body}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleMutation.mutate({ templateId: t.id, active: !t.active })}
                disabled={toggleMutation.isPending}
              >
                {t.active ? "Desactivar" : "Activar"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
