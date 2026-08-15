import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    let cancelled = false;

    async function enter() {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
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
  }, [navigate, router]);

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
