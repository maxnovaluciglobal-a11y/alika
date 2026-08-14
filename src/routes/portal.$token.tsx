import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { openPortalSession } from "@/lib/portal.functions";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    open({ data: { token } })
      .then(() => {
        if (!cancelled) navigate({ to: "/portal/inicio", replace: true });
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Link inválido o vencido.");
      });
    return () => {
      cancelled = true;
    };
  }, [token, open, navigate]);

  if (error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm font-medium">Tu enlace no es válido o ya venció.</p>
        <p className="text-xs text-muted-foreground">
          Pedile a tu clínica un enlace nuevo por WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
      <Loader2 className="size-6 animate-spin text-brand" />
    </div>
  );
}
