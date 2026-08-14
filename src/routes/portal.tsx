import { createFileRoute } from "@tanstack/react-router";
import { Clock, Phone } from "lucide-react";

/**
 * Portal del paciente PAUSADO en producción hasta v2.
 *
 * El árbol de rutas /portal/* existe (index, reservar, tratamientos,
 * documentos) pero sirve datos de fixture (clinic-data.ts). Mostrarlo
 * en producción implicaría exponer nombres/citas ficticias a cualquier
 * visitante con la URL, sin auth de paciente.
 *
 * El layout se reemplaza por una pantalla "próximamente" hasta que
 * decidamos la Opción C (URL firmada por wa.me) o la Opción B (OTP
 * por WhatsApp/SMS). Los archivos portal.*.tsx siguen en el repo para
 * reactivar cuando esté la arquitectura de auth de paciente.
 */
export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Portal del paciente · Alika" },
      {
        name: "description",
        content:
          "El portal del paciente de Alika llega pronto. Por ahora contactá a tu clínica por WhatsApp o teléfono.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalComingSoon,
});

function PortalComingSoon() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-brand-soft">
        <Clock className="size-7 text-brand" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">Muy pronto</h1>
        <p className="text-sm text-muted-foreground">
          Estamos terminando el portal para pacientes. Por ahora, comunicate directo con tu clínica
          para reservar horas o consultar tratamientos.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground">
        <Phone className="size-4 shrink-0 text-brand" />
        <span>Contactanos por WhatsApp o teléfono con tu clínica.</span>
      </div>
    </div>
  );
}
