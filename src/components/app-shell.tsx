import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
  Sparkles,
  Moon,
  Sun,
  MessageCircleMore,
  Landmark,
} from "lucide-react";

import { GlobalSearch } from "@/components/global-search";
import { NotificationsBell } from "@/components/notifications-bell";
import { RoleSimulationBar } from "@/components/role-simulation-bar";
import { TrialBanner } from "@/components/trial-banner";
import { DemoBanner } from "@/components/demo-banner";
import { supabase } from "@/integrations/supabase/client";
import { hasPermission, ROLE_LABELS, type ClinicAccess, type Permission } from "@/lib/access";
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
  { to: "/equipo", label: "Equipo", icon: UsersRound, permission: "team:view" },
  { to: "/permisos", label: "Permisos", icon: ShieldCheck, permission: "team:manage" },
  { to: "/compliance", label: "Compliance", icon: FileSearch, permission: "team:manage" },
  { to: "/preferencias", label: "Preferencias", icon: BellRing, permission: "dashboard:view" },
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

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
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

  const visibleNav = nav.filter((item) => hasPermission(access.role, item.permission));

  async function handleSignOut() {
    setSigningOut(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-surface text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="p-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-brand">
              <span className="size-4 rounded-full border-2 border-brand-foreground" />
            </span>
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
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="m-4 rounded-xl border border-ai/15 bg-ai-soft p-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ai">
            <Sparkles className="size-3" /> Asistente IA
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            3 pacientes podrían reagendar hoy para optimizar el Box 2.
          </p>
          <button className="w-full rounded-lg bg-ai py-2 text-xs font-medium text-ai-foreground transition-opacity hover:opacity-90">
            Ver sugerencias
          </button>
        </div>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-5 sm:px-8">
          <h1 className="font-display text-lg font-semibold">{title}</h1>
          <div className="flex items-center gap-3">
            <GlobalSearch />
            <NotificationsBell userId={access.userId} />
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
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-xs",
                  active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 p-5 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
