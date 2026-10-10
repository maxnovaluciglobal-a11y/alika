import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { EsmaliaLogo } from "@/components/esmalia-logo";
import { getSupabase } from "@/integrations/supabase/lazy";
import { peekPlanIntent } from "@/lib/marketing/plan-intent";
import { mensajeDeError } from "@/lib/mensaje-error";
import {
  esLimitePorCuenta,
  LARGO_MINIMO_CLAVE,
  MENSAJE_ENLACE_ENVIADO,
  RUTA_NUEVA_CLAVE,
} from "@/lib/recuperar-clave";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.87-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A11.998 11.998 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.62l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

// El router ya parsea `?x=1` como el número 1 (JSON), no como el texto "1".
function esVerdadero(valor: unknown): true | undefined {
  return valor === "1" || valor === 1 || valor === true || undefined;
}

export const Route = createFileRoute("/auth")({
  // Opcional a propósito: si `signup` fuera requerido, TanStack Router exige
  // `search={{ signup: ... }}` en TODO `<Link to="/auth">` del repo (varios,
  // sin relación con "comprar"). Con `?: boolean` sigue siendo type-safe pero
  // nadie más tiene que enterarse de este parámetro nuevo.
  // `recuperar` abre directo el formulario de "Olvidé mi contraseña" (lo usa
  // el botón "Pedir otro enlace" de /auth/nueva-clave).
  validateSearch: (search: Record<string, unknown>): { signup?: boolean; recuperar?: boolean } => ({
    signup: esVerdadero(search.signup),
    recuperar: esVerdadero(search.recuperar),
  }),
  head: () => ({
    meta: [
      { title: "Acceder a Esmalia — Gestión odontológica" },
      {
        name: "description",
        content:
          "Inicia sesión o crea tu cuenta de Esmalia para configurar tu clínica dental, sucursales y equipo profesional.",
      },
      { property: "og:title", content: "Acceder a Esmalia — Gestión odontológica" },
      {
        property: "og:description",
        content: "Accede a Esmalia y configura tu clínica dental en minutos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { signup, recuperar } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup" | "recover">(
    recuperar ? "recover" : signup ? "signup" : "signin",
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  // Solo después de que la persona cambia de modo: en la carga inicial el
  // foco tiene que quedar donde lo deja el navegador.
  const [cambioDeModo, setCambioDeModo] = useState(false);

  useEffect(() => {
    if (cambioDeModo) tituloRef.current?.focus();
  }, [mode, cambioDeModo]);

  function cambiarModo(siguiente: "signin" | "signup" | "recover") {
    setMode(siguiente);
    setError(null);
    setMessage(null);
    setCambioDeModo(true);
  }

  async function handleRecover(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = await getSupabase();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + RUTA_NUEVA_CLAVE,
      });
      // Mismo mensaje exista o no la cuenta: no se revela quién está registrado.
      if (resetError && !esLimitePorCuenta(resetError)) {
        setError(mensajeDeError(resetError));
      } else {
        setMessage(MENSAJE_ENLACE_ENVIADO);
      }
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setLoading(false);
    }
  }

  // Google redirige de vuelta acá con la sesión en el hash de la URL.
  // supabase-js la detecta y establece automáticamente (detectSessionInUrl,
  // default true) — este listener solo reacciona una vez que ya está lista.
  useEffect(() => {
    let desuscribir: (() => void) | undefined;
    let cancelado = false;

    void getSupabase().then((supabase) => {
      if (cancelado) return;
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") {
          router
            .invalidate()
            .then(() => navigate({ to: peekPlanIntent() ? "/suscripcion" : "/dashboard" }));
        }
      });
      desuscribir = () => subscription.unsubscribe();
      if (cancelado) {
        desuscribir();
        return;
      }

      // Red de seguridad para el retorno de Google: `detectSessionInUrl` puede
      // haber consumido el hash antes de que este listener existiera, y ahí el
      // SIGNED_IN no llega nunca. Sólo se consulta cuando el hash trae un
      // token — así un usuario ya logueado que entra a /auth a propósito sigue
      // viendo el formulario en vez de rebotar al dashboard.
      if (window.location.hash.includes("access_token")) {
        void supabase.auth.getSession().then(({ data }) => {
          if (cancelado || !data.session) return;
          router
            .invalidate()
            .then(() => navigate({ to: peekPlanIntent() ? "/suscripcion" : "/dashboard" }));
        });
      }
    });

    return () => {
      cancelado = true;
      desuscribir?.();
    };
  }, [navigate, router]);

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const supabase = await getSupabase();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth" },
    });
    if (oauthError) {
      setError("No se pudo iniciar sesión con Google. Intenta nuevamente.");
      setGoogleLoading(false);
    }
    // Si no hay error, el navegador ya está siendo redirigido a Google.
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const supabase = await getSupabase();

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
        },
      });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setMessage("Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.");
        } else {
          await router.invalidate();
          navigate({ to: peekPlanIntent() ? "/suscripcion" : "/dashboard" });
        }
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
      } else {
        await router.invalidate();
        navigate({ to: peekPlanIntent() ? "/suscripcion" : "/dashboard" });
      }
    }

    setLoading(false);
  }

  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-surface px-4 py-12"
    >
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <span aria-hidden>←</span> Volver al inicio
        </Link>

        <div className="mb-8 flex items-center justify-center">
          <EsmaliaLogo size={34} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1
            ref={tituloRef}
            tabIndex={-1}
            className="font-display text-xl font-semibold outline-none"
          >
            {mode === "signin"
              ? "Ingresa a tu clínica"
              : mode === "signup"
                ? "Crea tu cuenta"
                : "Recupera tu contraseña"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Accede para gestionar agenda, pacientes y equipo."
              : mode === "signup"
                ? "En pocos minutos dejas tu clínica configurada."
                : "Escribe el correo con el que entras y te mandamos un enlace para crear una contraseña nueva."}
          </p>

          {mode === "recover" ? (
            <form onSubmit={handleRecover} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-medium">
                  Correo
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none pointer-coarse:text-base focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div aria-live="polite" role="status">
                {error && <p className="text-xs text-destructive">{error}</p>}
                {message && <p className="text-xs text-muted-foreground">{message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className={cn(buttonVariants({ size: "lg" }), "w-full")}
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Enviarme un enlace
              </button>
            </form>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60 pointer-coarse:min-h-11"
              >
                {googleLoading ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
                Continuar con Google
              </button>

              <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                <span className="h-px flex-1 bg-border" />o con tu correo
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div>
                    <label htmlFor="fullName" className="mb-1.5 block text-xs font-medium">
                      Nombre completo
                    </label>
                    <input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none pointer-coarse:text-base focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-medium">
                    Correo
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none pointer-coarse:text-base focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2 pointer-coarse:mb-0">
                    <label htmlFor="password" className="block text-xs font-medium">
                      Contraseña
                    </label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => cambiarModo("recover")}
                        className="inline-flex items-center text-xs font-medium text-brand-700 hover:underline pointer-coarse:min-h-11"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <input
                    id="password"
                    type="password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={LARGO_MINIMO_CLAVE}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none pointer-coarse:text-base focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div aria-live="polite" role="status">
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  {message && <p className="text-xs text-muted-foreground">{message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={cn(buttonVariants({ size: "lg" }), "w-full")}
                >
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  {mode === "signin" ? "Ingresar" : "Crear cuenta"}
                </button>
                {mode === "signup" && (
                  <p className="text-center text-xs text-muted-foreground">
                    Al crear tu cuenta aceptas los{" "}
                    <Link to="/terminos" className="font-medium text-brand-700 hover:underline">
                      Términos
                    </Link>
                    , la{" "}
                    <Link to="/privacidad" className="font-medium text-brand-700 hover:underline">
                      Política de privacidad
                    </Link>{" "}
                    y el{" "}
                    <Link to="/dpa" className="font-medium text-brand-700 hover:underline">
                      Acuerdo de tratamiento de datos
                    </Link>
                    .
                  </p>
                )}
              </form>
            </>
          )}

          <p className="mt-5 text-center text-xs text-muted-foreground">
            {mode === "recover" ? (
              <>
                ¿Ya la recordaste?{" "}
                <button
                  type="button"
                  onClick={() => cambiarModo("signin")}
                  className="inline-flex items-center font-medium text-brand-700 hover:underline pointer-coarse:min-h-11"
                >
                  Vuelve a iniciar sesión
                </button>
              </>
            ) : (
              <>
                {mode === "signin" ? "¿Aún no tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
                <button
                  type="button"
                  onClick={() => cambiarModo(mode === "signin" ? "signup" : "signin")}
                  className="inline-flex items-center font-medium text-brand-700 hover:underline pointer-coarse:min-h-11"
                >
                  {mode === "signin" ? "Regístrate" : "Inicia sesión"}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}
