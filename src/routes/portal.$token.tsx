import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle } from "lucide-react";

import { getExpiredPortalContact, openPortalSession } from "@/lib/portal.functions";

/**
 * Entrada del portal: `alika.com/portal/<jwt>`.
 *
 * `openPortalSession` valida el token y setea la cookie HttpOnly via
 * `Set-Cookie`. La llamada debe ir a través del HTTP boundary (fetch
 * cliente → server) para que el navegador reciba el header — por eso
 * corre en useEffect y no en beforeLoad (que puede correr SSR).
 *
 * Éxito: navigate a `/portal/inicio`. Fallo: mensaje de link vencido.
 */
export const Route = createFileRoute("/portal/$token")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex" }],
  }),
  component: PortalTokenExchange,
});

function PortalTokenExchange() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const open = useServerFn(openPortalSession);
  const fetchContact = useServerFn(getExpiredPortalContact);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState<{ clinicName: string; waUrl: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    open({ data: { token } })
      .then(() => {
        if (!cancelled) navigate({ to: "/portal/inicio", replace: true });
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message || "Link inválido o vencido.");
        // Best-effort: si el token venció (firma válida, solo pasado de
        // fecha) esto trae el WhatsApp real de la clínica en vez de dejar
        // al paciente con un "contactá a tu clínica" sin ningún dato.
        void fetchContact({ data: { token } })
          .then((c) => !cancelled && setContact(c))
          .catch(() => {});
      });
    return () => {
      cancelled = true;
    };
  }, [token, open, fetchContact, navigate]);

  if (error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm font-medium">Tu enlace no es válido o ya venció.</p>
        {contact?.waUrl ? (
          <a
            href={contact.waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-medium text-brand-foreground"
          >
            <MessageCircle className="size-4" />
            Escribir a {contact.clinicName} por WhatsApp
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">
            Pídele a tu clínica un enlace nuevo por WhatsApp.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
      <Loader2 className="size-6 animate-spin text-brand" />
    </div>
  );
}
