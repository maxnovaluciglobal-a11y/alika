import { useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { getSupabase } from "@/integrations/supabase/lazy";
import { ensureDemoClinicFresh } from "@/lib/demo.functions";
import { LeadForm } from "@/components/marketing/lead-form";
import { AlikaLogo } from "@/components/alika-logo";

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

/**
 * Antes esto entraba directo, sin pedir nada (auto-login en el mount) — Walter,
 * 08-sep-2026: "no hay ningún esfuerzo para capturar correo". Mismo criterio
 * que ya se aplicó en DypOS (commit 262c51a, mismo día): bloqueo duro,
 * nombre+email obligatorios antes de ver el panel. Reusa el `LeadForm` que ya
 * usan la calculadora y el checklist — mismo honeypot, mismo consentimiento
 * separado por WhatsApp, misma tabla `marketing_leads` (source="demo"), y
 * por lo tanto aparece solo en `/admin/leads` sin infraestructura nueva.
 */
function DemoPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ensureFresh = useServerFn(ensureDemoClinicFresh);

  async function entrar() {
    setEntrando(true);
    // No bloquea el login si falla — peor caso, la demo se ve con los
    // datos del último reset en vez de quedar sin poder entrar.
    const freshPromise = ensureFresh().catch((e: Error) => {
      console.error("[demo] ensureDemoClinicFresh failed", e.message);
    });
    const supabase = await getSupabase();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    await freshPromise;
    if (signInError) {
      setError("No pudimos abrir la demo. Intenta de nuevo en unos minutos.");
      setEntrando(false);
      return;
    }
    await router.invalidate();
    navigate({ to: "/dashboard" });
  }

  if (entrando) {
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

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-4 py-12">
      <div className="text-center">
        <AlikaLogo size={36} className="mx-auto mb-4" />
        <h1 className="font-display text-2xl font-semibold">Antes de entrar a la demo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No pedimos tarjeta ni contraseña — solo para saber a quién le mostramos el panel.
        </p>
      </div>
      <LeadForm
        source="demo"
        pais="CL"
        tituloExito="¡Listo!"
        textoBoton="Entrar a la demo"
        onSuccess={() => void entrar()}
      />
    </div>
  );
}
