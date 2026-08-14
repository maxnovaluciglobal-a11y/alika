import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Link2, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { generatePortalLink } from "@/lib/portal.functions";
import { cn } from "@/lib/utils";

interface Props {
  clinicId: string;
  patientId: string;
}

/**
 * Botón en la ficha del paciente (admin) para generar un link firmado
 * del portal (7 días de validez por default), copiarlo o mandarlo por
 * WhatsApp al paciente. Sin login, sin Twilio — el link vale por sí solo.
 */
export function PortalLinkButton({ clinicId, patientId }: Props) {
  const generate = useServerFn(generatePortalLink);
  const [copiedAt, setCopiedAt] = useState<number | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      generate({
        data: {
          clinicId,
          patientId,
          baseUrl: window.location.origin,
          ttlDays: 7,
        },
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  async function copy() {
    if (!mut.data) return;
    await navigator.clipboard.writeText(mut.data.url);
    setCopiedAt(Date.now());
    setTimeout(() => setCopiedAt(null), 2000);
    toast.success("Link copiado al portapapeles");
  }

  function openWhatsApp() {
    if (!mut.data?.waUrl) return;
    window.open(mut.data.waUrl, "_blank", "noopener,noreferrer");
  }

  if (!mut.data) {
    return (
      <button
        type="button"
        onClick={() => mut.mutate()}
        disabled={mut.isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
      >
        {mut.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Link2 className="size-3.5 text-brand" />
        )}
        Generar link del portal
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-hairline bg-card p-3">
      <p className="text-[11px] text-muted-foreground">
        Link válido {mut.data.expiresInDays} día{mut.data.expiresInDays === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-[11px] text-foreground/80">
          {mut.data.url}
        </code>
        <button
          type="button"
          onClick={copy}
          className={cn(
            "shrink-0 rounded-lg border border-hairline bg-background p-1.5 text-muted-foreground hover:text-foreground",
            copiedAt && "text-brand",
          )}
          aria-label="Copiar link"
        >
          {copiedAt ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
        {mut.data.waUrl && (
          <button
            type="button"
            onClick={openWhatsApp}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand px-2 py-1.5 text-[11px] font-medium text-brand-foreground hover:bg-brand/90"
          >
            <MessageCircle className="size-3.5" /> WhatsApp
          </button>
        )}
      </div>
    </div>
  );
}
