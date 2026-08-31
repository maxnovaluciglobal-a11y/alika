import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Stethoscope,
  Settings,
  UsersRound,
  FileSearch,
  ShieldCheck,
  BellRing,
  FlaskConical,
  MailCheck,
  LogOut,
  Moon,
  Sun,
  LifeBuoy,
  MessageCircleMore,
  MessageCircle,
  Landmark,
  Percent,
  Boxes,
  Building2,
  FileSignature,
  UserRound,
} from "lucide-react";

import { AlikaLogo } from "@/components/alika-logo";
import { GlobalSearch } from "@/components/global-search";
import { NotificationsBell } from "@/components/notifications-bell";
import { RoleSimulationBar } from "@/components/role-simulation-bar";
import { TrialBanner } from "@/components/trial-banner";
import { DemoBanner } from "@/components/demo-banner";
import { OfflineBanner } from "@/components/offline-banner";
import { PendingSyncBanner } from "@/components/pending-sync-banner";
import { supabase } from "@/integrations/supabase/client";
import { resetOfflineCache } from "@/lib/offline-cache";
import { useSincronizacionAutomatica } from "@/hooks/use-offline-mutation";
import { leerCola, pendientes } from "@/lib/offline-queue";
import { hasPermission, ROLE_LABELS, type ClinicAccess, type Permission } from "@/lib/access";
import { listPendingOutreach, listPendingReminders } from "@/lib/messaging.functions";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:view" },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, permission: "agenda:view" },
  {
    to: "/recordatorios",
    label: "Recordatorios",
    icon: MessageCircleMore,
    permission: "agenda:manage",
  },
  { to: "/pacientes", label: "Pacientes", icon: Users, permission: "patients:view" },
  { to: "/tratamientos", label: "Tratamientos", icon: Stethoscope, permission: "treatments:view" },
  { to: "/finanzas", label: "Finanzas", icon: Landmark, permission: "finance:view" },
  { to: "/comisiones", label: "Comisiones", icon: Percent, permission: "finance:view" },
  { to: "/inventario", label: "Inventario", icon: Boxes, permission: "inventory:view" },
  { to: "/equipo", label: "Equipo", icon: UsersRound, permission: "team:view" },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle, permission: "team:manage" },
  { to: "/permisos", label: "Permisos", icon: ShieldCheck, permission: "team:manage" },
  { to: "/compliance", label: "Compliance", icon: FileSearch, permission: "team:manage" },
  { to: "/preferencias", label: "Preferencias", icon: BellRing, permission: "dashboard:view" },
  { to: "/sucursales", label: "Sucursales", icon: Building2, permission: "settings:manage" },
  {
    to: "/profesionales",
    label: "Profesionales",
    icon: UserRound,
    permission: "settings:manage",
  },
  {
    to: "/consentimientos",
    label: "Consentimientos",
    icon: FileSignature,
    permission: "settings:manage",
  },
  { to: "/sandbox-email", label: "Sandbox email", icon: FlaskConical, permission: "team:manage" },
  { to: "/dominio-email", label: "Dominio de email", icon: ShieldCheck, permission: "team:manage" },
  { to: "/pruebas-email", label: "Pruebas de email", icon: MailCheck, permission: "team:manage" },

  { to: "/onboarding", label: "Configuración", icon: Settings, permission: "settings:manage" },
] as const satisfies readonly {
  to: string;
  label: string;
  icon: typeof Users;
  permission: Permission;
}[];

// Mismo destino de contacto que usan las páginas públicas (nosotros/privacidad/
// términos/faq): no hay número de WhatsApp de soporte, solo este mailto.
const SUPPORT_EMAIL = "maxnovaluciglobal@gmail.com";

function SupportLink() {
  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}`}
      title="Reportar un problema"
      aria-label="Reportar un problema o pedir soporte"
      className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <LifeBuoy className="size-4" />
    </a>
  );
}

const THEME_STORAGE_KEY = "alika:theme";

function ThemeToggle() {
  // Arranca en "claro" para que el primer render coincida con el del server
  // (TanStack Start SSR no tiene window/localStorage) y no rompa la
  // hidratación. La preferencia real (guardada, o si no la del SO) se aplica
  // recién en el efecto de montaje, que solo corre en el cliente.
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const guardado = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (guardado === "dark" || guardado === "light") {
      setDark(guardado === "dark");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setDark(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  function alternar() {
    setDark((d) => {
      const next = !d;
      window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
      return next;
    });
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function initials(name: string | null, email: string | null) {
  const base = (name ?? email ?? "?").trim();
  const parts = base.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

export function AppShell({
  title,
  access,
  children,
}: {
  title: string;
  access: ClinicAccess;
  children: React.ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  // Una sola vez para toda la app: si cada pantalla lo montara, varias
  // sincronizaciones competirían por la misma cola.
  useSincronizacionAutomatica(access.userId);

  const visibleNav = nav.filter((item) => hasPermission(access.role, item.permission));

  // Badge de "Recordatorios": sin recepción, un dentista solo puede olvidarse
  // de entrar a despachar la cola a mano. Solo se calcula si el rol puede
  // ver esa sección — mismo queryKey que /recordatorios para compartir cache.
  const clinicId = access.clinic?.id;
  const puedeVerRecordatorios = hasPermission(access.role, "agenda:manage") && Boolean(clinicId);
  const fetchReminders = useServerFn(listPendingReminders);
  const { data: recordatoriosPendientes = [] } = useQuery({
    queryKey: ["pending-reminders", clinicId],
    enabled: puedeVerRecordatorios,
    queryFn: () => fetchReminders({ data: { clinicId: clinicId! } }),
    refetchInterval: 60_000,
  });
  const fetchOutreach = useServerFn(listPendingOutreach);
  const { data: outreachPendiente = [] } = useQuery({
    queryKey: ["pending-outreach", clinicId],
    enabled: puedeVerRecordatorios,
    queryFn: () => fetchOutreach({ data: { clinicId: clinicId! } }),
    refetchInterval: 60_000,
  });
  const recordatoriosBadge = recordatoriosPendientes.length + outreachPendiente.length;

  async function handleSignOut() {
    // La cola NO se borra al salir (son cobros ya hechos), pero quien se va
    // tiene que enterarse de que quedó algo sin subir.
    const sinSincronizar = pendientes(await leerCola()).filter(
      (i) => i.userId === access.userId,
    ).length;
    if (sinSincronizar > 0) {
      const seguir = window.confirm(
        `Quedan ${sinSincronizar} operación(es) guardadas en este equipo sin sincronizar. ` +
          `No se pierden: se van a subir cuando vuelvas a entrar con internet. ¿Cerrar sesión igual?`,
      );
      if (!seguir) return;
    }
    setSigningOut(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    // No alcanza con limpiar memoria: en una PC compartida los datos de
    // pacientes quedarían en IndexedDB para el próximo que entre.
    await resetOfflineCache();
    // scope "local" a propósito: la clínica demo comparte una sola cuenta
    // (demo@alika.app) entre todos los visitantes anónimos. El scope por
    // defecto de Supabase ("global") revoca el refresh token en el server
    // para TODA sesión de ese user, así que cualquier visitante que cierre
    // sesión echaba de la demo a cualquier otro visitante concurrente.
    await supabase.auth.signOut({ scope: "local" });
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-surface text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="p-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <AlikaLogo tone="brand" size={32} />
            <span className="font-display text-xl font-bold tracking-tight text-brand">Alika</span>
          </Link>
          {access.clinic && (
            <p className="mt-2 truncate text-xs text-muted-foreground">{access.clinic.name}</p>
          )}
        </div>

        <nav className="flex-1 space-y-1 px-4">
          {visibleNav.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                <Icon className="size-4" />
                <span>{label}</span>
                {to === "/recordatorios" && recordatoriosBadge > 0 && (
                  <span className="ml-auto min-w-4 rounded-full bg-brand px-1 text-[10px] font-semibold leading-4 text-brand-foreground">
                    {recordatoriosBadge > 9 ? "9+" : recordatoriosBadge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main id="main-content" className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-5 sm:px-8">
          <h1 className="font-display text-lg font-semibold">{title}</h1>
          <div className="flex items-center gap-3">
            <GlobalSearch />
            <NotificationsBell userId={access.userId} />
            <SupportLink />
            <ThemeToggle />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">
                {access.fullName ?? access.email ?? "Mi cuenta"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {access.role ? ROLE_LABELS[access.role] : "Sin rol"}
                {access.simulatedRole ? " · simulado" : ""}
              </p>
            </div>
            {access.avatarUrl ? (
              <img
                src={access.avatarUrl}
                alt={access.fullName ?? "Avatar"}
                width={40}
                height={40}
                loading="lazy"
                className="size-10 rounded-full object-cover outline outline-offset-[-1px] outline-border"
              />
            ) : (
              <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                {initials(access.fullName, access.email)}
              </span>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label="Cerrar sesión"
              className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        <RoleSimulationBar access={access} />
        <OfflineBanner />
        <PendingSyncBanner userId={access.userId} />
        {access.clinic?.isDemo ? (
          <DemoBanner />
        ) : (
          access.clinic && <TrialBanner clinicId={access.clinic.id} />
        )}

        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-5 py-2 lg:hidden">
          {visibleNav.map(({ to, label }) => {
            const active = pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground",
                )}
              >
                {label}
                {to === "/recordatorios" && recordatoriosBadge > 0 && (
                  <span className="min-w-4 rounded-full bg-brand px-1 text-[10px] font-semibold leading-4 text-brand-foreground">
                    {recordatoriosBadge > 9 ? "9+" : recordatoriosBadge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 p-5 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
