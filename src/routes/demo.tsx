import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ensureDemoClinicFresh } from "@/lib/demo.functions";

// Credenciales de la clínica demo pública, de solo lectura (bloqueo por
// trigger, ver migración 20260815180000). No son un secreto: cualquiera
// puede entrar a la demo, ese es el punto.
const DEMO_EMAIL = "demo@alika.app";
const DEMO_PASSWORD = "AlikaDemo2026!";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [{ title: "Demo — Alika" }, { name: "robots", content: "noindex" }],
  }),
  component: DemoPage,
});

function DemoPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const ensureFresh = useServerFn(ensureDemoClinicFresh);

  useEffect(() => {
    let cancelled = false;

    async function enter() {
      // No bloquea el login si falla — peor caso, la demo se ve con los
      // datos del último reset en vez de quedar sin poder entrar.
      const freshPromise = ensureFresh().catch((e: Error) => {
        console.error("[demo] ensureDemoClinicFresh failed", e.message);
      });
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      await freshPromise;
      if (cancelled) return;
      if (signInError) {
        setError("No pudimos abrir la demo. Intenta de nuevo en unos minutos.");
        return;
      }
      await router.invalidate();
      navigate({ to: "/dashboard" });
    }

    void enter();
    return () => {
      cancelled = true;
    };
  }, [navigate, router, ensureFresh]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface px-4 text-center">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <>
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Abriendo la clínica demo…</p>
        </>
      )}
    </div>
  );
}
