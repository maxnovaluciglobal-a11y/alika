import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { getSupabase } from "@/integrations/supabase/lazy";
import { registrarEvento } from "@/lib/marketing/eventos";

/**
 * Banner fijo en la clínica demo pública: de solo lectura (bloqueo por
 * trigger, ver migración 20260815180000). Recuerda al visitante que
 * cualquier intento de guardar va a fallar a propósito.
 *
 * "Crear mi clínica gratis" es el CTA de más intención del sitio (ya vio el
 * producto): lleva directo al alta (`/auth?signup=true`), no a la landing.
 * Antes cierra la sesión de la demo, porque si no el alta convive con la
 * sesión del usuario demo y el visitante sigue viendo la clínica de prueba.
 */
export function DemoBanner() {
  const navigate = useNavigate();
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function crearClinica() {
    if (saliendo) return;
    setSaliendo(true);
    registrarEvento("cta_click", { cta: "crear_clinica", lugar: "demo_banner" });
    try {
      const supabase = await getSupabase();
      await supabase.auth.signOut();
    } catch {
      // Si falla el cierre, igual lo llevamos al alta.
    }
    await router.invalidate();
    navigate({ to: "/auth", search: { signup: true } });
  }

  return (
    <div className="flex flex-col items-start gap-2 border-b border-brand/40 bg-brand-100 px-5 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-8">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-brand-700" />
        <span>
          Estás en la <strong>clínica demo</strong>. Puedes tocar todo, pero los cambios no se
          guardan.
        </span>
      </div>
      <a
        href="/auth?signup=true"
        onClick={(e) => {
          e.preventDefault();
          void crearClinica();
        }}
        aria-disabled={saliendo}
        className="shrink-0 rounded-md border border-brand bg-transparent px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand/12"
      >
        Crear mi clínica gratis
      </a>
    </div>
  );
}
