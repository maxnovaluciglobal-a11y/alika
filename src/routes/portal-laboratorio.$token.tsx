import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { openLabPortalSession } from "@/lib/clinic-operations/lab-portal.functions";

/**
 * Entrada del portal de laboratorio: `alika.com/portal-laboratorio/<jwt>`.
 * Mismo mecanismo que `/portal/$token` — ver ese archivo para el porqué del
 * useEffect (el Set-Cookie necesita el boundary HTTP real, no SSR).
 */
export const Route = createFileRoute("/portal-laboratorio/$token")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: LabPortalTokenExchange,
});

function LabPortalTokenExchange() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const open = useServerFn(openLabPortalSession);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    open({ data: { token } })
      .then(() => {
        if (!cancelled) navigate({ to: "/portal-laboratorio/inicio", replace: true });
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
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-medium">Tu enlace no es válido o ya venció.</p>
        <p className="text-xs text-muted-foreground">Pedile a la clínica un enlace nuevo.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
      <Loader2 className="size-6 animate-spin text-brand" />
    </div>
  );
}
