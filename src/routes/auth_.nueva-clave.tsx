import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
import { EsmaliaLogo } from "@/components/esmalia-logo";
import { getSupabase } from "@/integrations/supabase/lazy";
import { mensajeDeError } from "@/lib/mensaje-error";
import { esCuentaDemo, MENSAJE_CUENTA_DEMO } from "@/lib/demo-cuenta";
import {
  LARGO_MINIMO_CLAVE,
  leerRetornoDeRecuperacion,
  mensajeDeErrorDeClave,
  validarNuevaClave,
} from "@/lib/recuperar-clave";
import { cn } from "@/lib/utils";

// `auth_` (con guion bajo) saca la ruta del layout de `/auth`: la URL es
// /auth/nueva-clave, pero no se renderiza dentro de la pantalla de login.
export const Route = createFileRoute("/auth_/nueva-clave")({
  head: () => ({
    meta: [{ title: "Nueva contraseña · Esmalia" }, { name: "robots", content: "noindex" }],
  }),
  component: NuevaClavePage,
});

type Estado = "verificando" | "listo" | "invalido";

function NuevaClavePage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [esInvitacion, setEsInvitacion] = useState(false);
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  // Cuando se resuelve el enlace, el foco va al título del estado nuevo para
  // que el lector de pantalla anuncie qué pasó.
  useEffect(() => {
    if (estado !== "verificando") tituloRef.current?.focus();
  }, [estado]);

  useEffect(() => {
    // Se lee ANTES de tocar el cliente: al inicializarse, supabase-js consume
    // el hash (#access_token=…) y lo borra de la barra de direcciones.
    const retorno = leerRetornoDeRecuperacion(window.location.search, window.location.hash);
    let cancelado = false;
    let desuscribir: (() => void) | undefined;

    const resolver = (siguiente: Estado) => {
      if (!cancelado) setEstado(siguiente);
    };

    if (retorno.tipo === "error" || retorno.tipo === "nada") {
      resolver("invalido");
      return;
    }

    void getSupabase()
      .then(async (supabase) => {
        if (retorno.tipo === "token_hash") {
          const { error: e } = await supabase.auth.verifyOtp({
            token_hash: retorno.tokenHash,
            type: retorno.otp,
          });
          if (!cancelado) setEsInvitacion(retorno.otp === "invite");
          resolver(e ? "invalido" : "listo");
          return;
        }

        if (retorno.tipo === "codigo") {
          const { error: e } = await supabase.auth.exchangeCodeForSession(retorno.code);
          resolver(e ? "invalido" : "listo");
          return;
        }

        // Flujo implícito: el cliente ya procesó el hash al inicializarse (y
        // emitió PASSWORD_RECOVERY, quizá antes de que este listener exista).
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event) => {
          if (event === "PASSWORD_RECOVERY") resolver("listo");
        });
        desuscribir = () => subscription.unsubscribe();
        const { data } = await supabase.auth.getSession();
        resolver(data.session ? "listo" : "invalido");
      })
      .catch(() => resolver("invalido"));

    return () => {
      cancelado = true;
      desuscribir?.();
    };
  }, []);

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    const invalida = validarNuevaClave(clave, repetida);
    if (invalida) {
      setError(invalida);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const supabase = await getSupabase();
      // La cuenta de la demo es pública: si alguien le cambia la clave, el
      // siguiente visitante queda afuera. Esto es solo la UI — la llamada a
      // GoTrue se puede hacer igual con la clave pública (ver PR: la guarda
      // autoritativa va en la base / un hook de Auth).
      const { data: actual } = await supabase.auth.getUser();
      if (esCuentaDemo(actual.user?.email)) {
        setError(MENSAJE_CUENTA_DEMO);
        setGuardando(false);
        return;
      }
      const { error: e } = await supabase.auth.updateUser({ password: clave });
      if (e) {
        setError(mensajeDeErrorDeClave(e) ?? mensajeDeError(e));
        setGuardando(false);
        return;
      }
      toast.success("Listo, tu contraseña quedó actualizada.");
      await router.invalidate();
      navigate({ to: "/dashboard" });
    } catch (e) {
      setError(mensajeDeError(e));
      setGuardando(false);
    }
  }

  const claseInput =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none pointer-coarse:text-base focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-surface px-4 py-12"
    >
      <div className="w-full max-w-md">
        <Link
          to="/auth"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline pointer-coarse:min-h-11"
        >
          <span aria-hidden>←</span> Volver a iniciar sesión
        </Link>

        <div className="mb-8 flex items-center justify-center">
          <EsmaliaLogo size={34} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {estado === "verificando" && (
            <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Revisando el enlace…
            </div>
          )}

          {estado === "invalido" && (
            <>
              <h1
                ref={tituloRef}
                tabIndex={-1}
                className="font-display text-xl font-semibold outline-none"
              >
                Este enlace ya no sirve
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Puede que haya vencido o que ya lo hayas usado. Por seguridad, cada enlace funciona
                una sola vez y por poco tiempo. Pide uno nuevo y ábrelo apenas te llegue.
              </p>
              <Link
                to="/auth"
                search={{ recuperar: true }}
                className={cn(buttonVariants({ size: "lg" }), "mt-6 w-full")}
              >
                Pedir otro enlace
              </Link>
            </>
          )}

          {estado === "listo" && (
            <>
              <h1
                ref={tituloRef}
                tabIndex={-1}
                className="font-display text-xl font-semibold outline-none"
              >
                {esInvitacion ? "Crea tu contraseña" : "Crea tu contraseña nueva"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {esInvitacion
                  ? `Te invitaron al equipo de tu clínica en Esmalia. Elige una contraseña de al menos ${LARGO_MINIMO_CLAVE} caracteres para entrar.`
                  : `Usa al menos ${LARGO_MINIMO_CLAVE} caracteres. Con esta vas a entrar desde ahora.`}
              </p>

              {/* noValidate: el largo y la coincidencia los valida `validarNuevaClave`,
                  con el mensaje en español en la región aria-live. */}
              <form onSubmit={guardar} noValidate className="mt-6 space-y-4">
                <div>
                  <label htmlFor="nueva-clave" className="mb-1.5 block text-xs font-medium">
                    Nueva contraseña
                  </label>
                  <input
                    id="nueva-clave"
                    type="password"
                    autoComplete="new-password"
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    required
                    minLength={LARGO_MINIMO_CLAVE}
                    className={claseInput}
                  />
                </div>

                <div>
                  <label htmlFor="repite-clave" className="mb-1.5 block text-xs font-medium">
                    Repite la contraseña
                  </label>
                  <input
                    id="repite-clave"
                    type="password"
                    autoComplete="new-password"
                    value={repetida}
                    onChange={(e) => setRepetida(e.target.value)}
                    required
                    minLength={LARGO_MINIMO_CLAVE}
                    className={claseInput}
                  />
                </div>

                <div aria-live="polite" role="status">
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>

                <button
                  type="submit"
                  disabled={guardando}
                  className={cn(buttonVariants({ size: "lg" }), "w-full")}
                >
                  {guardando && <Loader2 className="size-4 animate-spin" />}
                  Guardar contraseña
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
