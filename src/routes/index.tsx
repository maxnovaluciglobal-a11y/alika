import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CircleUserRound,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Alika · Software de gestión dental para LatAm" },
      {
        name: "description",
        content:
          "Alika unifica agenda, pacientes, historia clínica y finanzas de tu clínica dental con inteligencia artificial y acceso por roles.",
      },
      { property: "og:title", content: "Alika · Software de gestión dental para LatAm" },
      {
        property: "og:description",
        content:
          "Agenda, pacientes, historia clínica y finanzas en un solo lugar, con IA y roles por equipo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: CalendarDays,
    title: "Agenda por box y profesional",
    text: "Vista de día, lista de espera inteligente y predicción de ausencias.",
    featured: true,
  },
  {
    icon: ShieldCheck,
    title: "Roles y permisos reales",
    text: "Doctor, recepción, administración y contabilidad ven solo lo que les toca.",
    featured: false,
  },
  {
    icon: Stethoscope,
    title: "Ficha clínica viva",
    text: "Timeline por paciente, tratamientos y saldos siempre sincronizados.",
    featured: false,
  },
  {
    icon: Sparkles,
    title: "Asistente con IA",
    text: "Resúmenes clínicos y sugerencias para llenar huecos de agenda.",
    featured: true,
  },
];

const mockCitas = [
  { hora: "09:00", paciente: "P. González", tratamiento: "Control", estado: "confirmada" as const },
  {
    hora: "10:30",
    paciente: "R. Fernández",
    tratamiento: "Endodoncia",
    estado: "en-sala" as const,
  },
  { hora: "11:15", paciente: "M. Silva", tratamiento: "Limpieza", estado: "tentativa" as const },
];

const estadoBadge: Record<(typeof mockCitas)[number]["estado"], string> = {
  confirmada: "bg-brand-soft text-brand",
  "en-sala": "bg-warning-soft text-warning",
  tentativa: "bg-ai-soft text-ai",
};

const estadoLabel: Record<(typeof mockCitas)[number]["estado"], string> = {
  confirmada: "Confirmada",
  "en-sala": "En sala",
  tentativa: "Por confirmar",
};

const pasos = [
  {
    icon: CircleUserRound,
    title: "Creá tu clínica",
    text: "Nombre, sucursal y equipo profesional. Menos de 5 minutos, sin instalar nada.",
  },
  {
    icon: CalendarDays,
    title: "Cargá pacientes y agenda",
    text: "A mano, o importando tu planilla actual de un solo golpe.",
  },
  {
    icon: Wallet,
    title: "Atendé y cobrá",
    text: "Historia clínica, presupuestos, pagos y recordatorios por WhatsApp, todo conectado.",
  },
];

/**
 * Preview del producto para el hero. No es un screenshot (no hay clínicas
 * piloto con datos reales todavía para mostrar) ni un video de producción —
 * es una maqueta fiel con los mismos componentes y tokens de color que la
 * app real, así que lo que promete el hero es lo que el usuario ve al
 * entrar de verdad, no una ilustración abstracta desconectada.
 */
function ProductPreview() {
  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-8 -z-10 rounded-[3rem] bg-clay-soft blur-3xl" />
      <div className="animate-landing-rise card-clinical overflow-hidden shadow-xl shadow-foreground/5">
        <div className="flex items-center gap-1.5 border-b border-hairline bg-secondary/40 px-4 py-3">
          <span className="size-2.5 rounded-full bg-destructive/30" />
          <span className="size-2.5 rounded-full bg-warning/40" />
          <span className="size-2.5 rounded-full bg-success/40" />
          <span className="ml-2 text-[11px] font-medium text-muted-foreground">
            Agenda · Sucursal principal
          </span>
        </div>

        <div className="divide-y divide-hairline">
          {mockCitas.map((c) => (
            <div key={c.hora} className="flex items-center gap-3 px-4 py-3">
              <span className="font-mono text-xs text-muted-foreground">{c.hora}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.paciente}</p>
                <p className="truncate text-xs text-muted-foreground">{c.tratamiento}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                  estadoBadge[c.estado],
                )}
              >
                {estadoLabel[c.estado]}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-hairline bg-secondary/30 px-4 py-3.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Odontograma FDI
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-4 rounded-[4px] border",
                  i === 2 || i === 8
                    ? "border-clay bg-clay-soft"
                    : i === 5
                      ? "border-brand bg-brand-soft"
                      : "border-hairline bg-card",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-brand">
            <span className="size-4 rounded-full border-2 border-brand-foreground" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-brand">Alika</span>
        </span>
        <div className="flex items-center gap-2">
          <Link
            to="/portal"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Portal paciente
          </Link>
          <a
            href="/demo"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver demo
          </a>
          <Link
            to="/auth"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90"
          >
            Entrar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <p className="mb-5 inline-block rounded-full bg-clay-soft px-3 py-1 text-xs font-medium text-clay">
              Gestión dental moderna para Latinoamérica
            </p>
            <h1 className="font-serif-display text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              La clínica dental completa, en una sola pantalla.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Agenda, pacientes, historia clínica, tratamientos y finanzas con control de acceso por
              rol y un asistente de IA que trabaja contigo.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="rounded-lg bg-brand px-5 py-3 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90"
              >
                Crear mi clínica
              </Link>
              <Link
                to="/auth"
                className="rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium transition-colors hover:bg-secondary"
              >
                Ya tengo cuenta
              </Link>
              <a
                href="/demo"
                className="flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-medium text-clay transition-colors hover:bg-clay-soft"
              >
                <PlayCircle className="size-4" />
                Ver demo sin registrarte
              </a>
            </div>
            <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 shrink-0 text-brand" />
              Seguridad por diseño: cada rol de tu equipo ve solo los datos de paciente que le
              corresponden.
            </p>
          </div>

          <ProductPreview />
        </section>

        <section className="border-y border-hairline py-16">
          <div className="mb-10 max-w-xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-clay">
              Cómo funciona
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              De cero a tu primera cita agendada, hoy mismo.
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {pasos.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="relative">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-clay-soft text-sm font-semibold text-clay">
                    {i + 1}
                  </span>
                  <Icon className="size-5 text-muted-foreground" />
                </div>
                <h3 className="mb-1.5 font-display font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 pt-16 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, text, featured }) => (
            <article
              key={title}
              className={cn(
                "card-clinical p-7",
                featured && "sm:col-span-2 sm:flex sm:items-start sm:gap-6",
              )}
            >
              <Icon
                className={cn("mb-3 shrink-0 text-brand", featured ? "size-7 sm:mb-0" : "size-5")}
              />
              <div>
                <h2
                  className={cn(
                    "mb-1.5 font-display font-semibold",
                    featured ? "text-lg" : "text-base",
                  )}
                >
                  {title}
                </h2>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
