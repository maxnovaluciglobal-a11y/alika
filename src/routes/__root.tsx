import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportBoundaryError } from "../lib/error-reporting";
import { siteJsonLdScripts } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { captureException, initSentry } from "@/lib/sentry";
import { attachOfflineCache, resetOfflineCache } from "@/lib/offline-cache";
import { registerServiceWorker } from "@/lib/register-sw";
import { Toaster } from "@/components/ui/sonner";

// Se ejecuta una sola vez al importar el módulo raíz. No-op si no hay DSN.
initSentry();
// Idem: no-op en dev y si el navegador no soporta service workers.
registerServiceWorker();

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportBoundaryError(error, { boundary: "tanstack_root_error_component" });
    captureException(error, { tags: { boundary: "tanstack_root_error_component" } });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

// Mismo criterio que src/routes/sitemap[.]xml.ts: PUBLIC_APP_URL manda si está
// seteada; si no, se cae al dominio real de hoy (alika.com todavía no está
// comprado, ver docs/DEPLOY_PRODUCTION.md). og:image/twitter:image necesitan
// una URL absoluta — no alcanza con una ruta relativa como en <img src>.
const SITE_URL =
  (typeof process !== "undefined" && process.env.PUBLIC_APP_URL) ||
  "https://alika-omega.vercel.app";

// Reusa la foto del hero de la landing (src/routes/index.tsx) como preview de
// WhatsApp/redes — no hay todavía un asset dedicado para social share.
const SOCIAL_IMAGE_URL = `${SITE_URL}/landing/dentist.jpg`;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Alika · Software de gestión dental" },
      {
        name: "description",
        content:
          "Alika es el sistema operativo de la clínica dental: agenda, pacientes, historia clínica e IA en una sola plataforma.",
      },
      { name: "author", content: "Alika" },
      { property: "og:title", content: "Alika · Software de gestión dental" },
      {
        property: "og:description",
        content: "Agenda, pacientes, historia clínica e IA para clínicas dentales de LatAm.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Alika" },
      { property: "og:locale", content: "es_LA" },
      { property: "og:image", content: SOCIAL_IMAGE_URL },
      { property: "og:image:width", content: "1280" },
      { property: "og:image:height", content: "853" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Alika · Software de gestión dental" },
      {
        name: "twitter:description",
        content: "Agenda, pacientes, historia clínica e IA para clínicas dentales de LatAm.",
      },
      { name: "twitter:image", content: SOCIAL_IMAGE_URL },
      // Pinta la barra del navegador con el teal de marca cuando la app corre
      // instalada (display: standalone).
      { name: "theme-color", content: "#0d9488" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Alika" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@500;600;700&family=Newsreader:wght@500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
    // Organization + WebSite + SoftwareApplication: no dependen de la ruta,
    // por eso van acá y no repetidos por página (mayor impacto GEO, ver
    // memoria alika_seo_geo_pendiente).
    scripts: siteJsonLdScripts(),
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Saltar al contenido principal
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Persistencia del cache en disco. Vive en un efecto (y no en un provider)
  // porque solo puede correr en el browser: en SSR no hay IndexedDB, y
  // `getRouter()` arma un QueryClient distinto por request.
  useEffect(() => {
    let detachCache: (() => void) | undefined;
    let cancelled = false;

    async function bindCacheTo(userId: string | undefined) {
      detachCache?.();
      detachCache = undefined;
      if (!userId) {
        // Sin sesión no dejamos nada del usuario anterior en el equipo.
        await resetOfflineCache();
        return;
      }
      // La restauración ya corrió en el guard de `_clinic`; acá solo queda
      // enganchar el guardado continuo.
      if (!cancelled) detachCache = attachOfflineCache(queryClient, userId);
    }

    void supabase.auth.getSession().then(({ data }) => bindCacheTo(data.session?.user.id));

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void bindCacheTo(session?.user.id);
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });

    return () => {
      cancelled = true;
      detachCache?.();
      data.subscription.unsubscribe();
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster richColors closeButton />
    </QueryClientProvider>
  );
}
