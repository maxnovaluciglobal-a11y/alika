import { createFileRoute } from "@tanstack/react-router";
import { Clock, Phone } from "lucide-react";

/**
 * Landing genérica cuando alguien abre `/portal` sin token. El acceso
 * real es siempre por link firmado `/portal/<jwt>` que la clínica envía.
 */
export const Route = createFileRoute("/portal/")({
  head: () => ({
    meta: [
      { title: "Portal del paciente · Alika" },
      {
        name: "description",
        content: "El acceso al portal es por el link que te envía tu clínica.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalIndex,
});

function PortalIndex() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-brand-soft">
        <Clock className="size-7 text-brand" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">Necesitás un link</h1>
        <p className="text-sm text-muted-foreground">
          El acceso al portal es por el enlace personal que te envía tu clínica por WhatsApp. Si no
          lo tenés, pedilo directamente a tu clínica.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground">
        <Phone className="size-4 shrink-0 text-brand" />
        <span>Contactá a tu clínica por WhatsApp o teléfono.</span>
      </div>
    </div>
  );
}
