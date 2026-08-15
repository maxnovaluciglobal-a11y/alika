import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CircleUserRound,
  MessageCircle,
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

// ── Motion helpers ──────────────────────────────────────────────────

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/** El "latido" del demo del hero: 5 beats en loop, cada uno enciende una
 *  cosa (confirmar cita → marcar diente → registrar pago → recordatorio)
 *  y al volver a 0 todo se apaga con transición. Pausa con reduced-motion. */
function useHeroBeat(reduce: boolean) {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (reduce) {
      setBeat(4); // estado "poblado" fijo, sin animar
      return;
    }
    const id = setInterval(() => setBeat((b) => (b + 1) % 5), 2400);
    return () => clearInterval(id);
  }, [reduce]);
  return beat;
}

/** Cuenta ascendente suave hacia `target` cuando cambia. */
function useCountUp(target: number, reduce: boolean, durationMs = 650) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    if (reduce) {
      setValue(target);
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduce, durationMs]);
  return value;
}

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

// ── Demo vivo del producto (hero) ───────────────────────────────────

const citas = [
  { hora: "09:00", paciente: "P. González", tratamiento: "Control y limpieza" },
  { hora: "10:30", paciente: "R. Fernández", tratamiento: "Ortodoncia" },
  { hora: "11:15", paciente: "M. Silva", tratamiento: "Endodoncia" },
];

// Fila superior FDI (18→11, 21→28). Algunas piezas ya vienen con condición.
const dientesFDI = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const preMarcados: Record<number, "caries" | "obturacion" | "endodoncia"> = {
  14: "obturacion",
  26: "endodoncia",
};
const condicionColor: Record<string, string> = {
  caries: "border-clay bg-clay-soft",
  obturacion: "border-brand bg-brand-soft",
  endodoncia: "border-ai bg-ai-soft",
};

function LiveProductPreview() {
  const reduce = usePrefersReducedMotion();
  const beat = useHeroBeat(reduce);
  const [hovered, setHovered] = useState<number | null>(null);

  // Estado derivado del beat.
  const citaConfirmada = beat >= 1; // R. Fernández pasa a confirmada
  const dienteDemo = beat >= 2 ? 16 : null; // se marca la pieza 16
  const cajaBase = 240000;
  const cajaTarget = beat >= 3 ? cajaBase + 35000 : cajaBase;
  const caja = useCountUp(cajaTarget, reduce);
  const reminderVisible = beat >= 4;

  return (
    <div className="animate-preview-float relative">
      {/* Halo cálido detrás de la tarjeta */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[3rem] bg-clay-soft/70 blur-3xl"
      />

      <div className="animate-landing-rise card-clinical overflow-hidden shadow-2xl shadow-foreground/10">
        {/* Chrome de navegador */}
        <div className="flex items-center gap-1.5 border-b border-hairline bg-secondary/50 px-4 py-3">
          <span className="size-2.5 rounded-full bg-destructive/30" />
          <span className="size-2.5 rounded-full bg-warning/40" />
          <span className="size-2.5 rounded-full bg-success/40" />
          <span className="ml-2 text-[11px] font-medium text-muted-foreground">
            app.alika · Clínica Providencia
          </span>
        </div>

        {/* Caja del día — métrica viva */}
        <div className="flex items-end justify-between border-b border-hairline px-4 py-3.5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Caja de hoy
            </p>
            <p
              className={cn(
                "font-display text-2xl font-semibold tabular-nums tracking-tight transition-colors",
                beat >= 3 ? "text-success" : "text-foreground",
              )}
            >
              {clp.format(caja)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="grid size-6 place-items-center rounded-md bg-brand-soft text-brand">
              <Wallet className="size-3.5" />
            </span>
            8 pagos
          </div>
        </div>

        {/* Agenda del día */}
        <div className="divide-y divide-hairline">
          {citas.map((c, i) => {
            const esConfirmada = i === 1 ? citaConfirmada : i === 0;
            return (
              <div key={c.hora} className="flex items-center gap-3 px-4 py-2.5">
                <span className="font-mono text-xs text-muted-foreground">{c.hora}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.paciente}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.tratamiento}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                    i === 2
                      ? "bg-ai-soft text-ai"
                      : esConfirmada
                        ? "bg-success-soft text-success"
                        : "bg-warning-soft text-warning",
                    i === 1 && citaConfirmada && "animate-confirm-pop",
                  )}
                >
                  {i === 2 ? "En sala" : esConfirmada ? "Confirmada" : "Por confirmar"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Odontograma FDI interactivo */}
        <div className="border-t border-hairline bg-secondary/30 px-4 py-3.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Odontograma FDI · pieza superior
            </p>
            <span className="text-[10px] text-muted-foreground/70">tocá una pieza</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {dientesFDI.map((n) => {
              const cond = preMarcados[n];
              const isDemo = dienteDemo === n;
              const isHover = hovered === n;
              const marked = cond ?? (isDemo || isHover ? "caries" : null);
              return (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered((h) => (h === n ? null : h))}
                  onFocus={() => setHovered(n)}
                  onBlur={() => setHovered((h) => (h === n ? null : h))}
                  aria-label={`Pieza ${n}${cond ? ` — ${cond}` : ""}`}
                  className={cn(
                    "grid size-6 place-items-center rounded-[5px] border text-[9px] font-medium tabular-nums transition-all duration-300",
                    marked
                      ? condicionColor[marked]
                      : "border-hairline bg-card text-muted-foreground/60 hover:border-clay/50",
                    (isHover || isDemo) && "-translate-y-0.5 shadow-sm",
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recordatorio de WhatsApp — entra en el último beat */}
      <div
        aria-hidden
        className={cn(
          "absolute -bottom-5 -left-5 flex max-w-[15rem] items-start gap-2.5 rounded-2xl border border-hairline bg-card p-3 shadow-xl shadow-foreground/10 transition-all duration-500",
          reminderVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0",
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-success-soft text-success">
          <MessageCircle className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-tight">Recordatorio enviado</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            “Hola Rocío, te esperamos mañana 10:30 en Providencia 👋”
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────

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

function Landing() {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-brand">
            <span className="size-4 rounded-full border-2 border-brand-foreground" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-brand">Alika</span>
        </span>
        <div className="flex items-center gap-2">
          <Link
            to="/portal"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
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
        {/* Hero */}
        <section className="relative isolate grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div aria-hidden className="hero-aurora" />
          <div aria-hidden className="hero-grain" />

          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-clay/20 bg-clay-soft/70 px-3 py-1 text-xs font-medium text-clay backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-clay" />
              Gestión dental moderna para Latinoamérica
            </p>

            <h1 className="font-serif-display text-[2.75rem] font-medium leading-[0.98] tracking-[-0.03em] text-balance sm:text-6xl lg:text-[4.5rem]">
              Toda tu clínica,{" "}
              <span className="relative whitespace-nowrap text-clay">
                en una pantalla
                <svg
                  aria-hidden
                  viewBox="0 0 300 18"
                  fill="none"
                  preserveAspectRatio="none"
                  className="absolute -bottom-1.5 left-0 h-3 w-full"
                >
                  <path
                    d="M3 12 C 70 4, 150 4, 297 9"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="animate-swash text-clay/50"
                  />
                </svg>
              </span>
              .
            </h1>

            <p className="mt-7 max-w-md text-lg leading-relaxed text-muted-foreground">
              Agenda, pacientes, historia clínica, tratamientos y finanzas. Con roles por equipo y
              un asistente de IA que trabaja con vos.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/30"
              >
                Crear mi clínica
              </Link>
              <a
                href="/demo"
                className="flex items-center gap-2 rounded-xl border border-border bg-card/70 px-5 py-3 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-secondary"
              >
                <PlayCircle className="size-4 text-clay" />
                Ver demo en vivo
              </a>
            </div>

            <p className="mt-9 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 shrink-0 text-brand" />
              Seguridad por diseño: cada rol ve solo los datos de paciente que le corresponden.
            </p>
          </div>

          <LiveProductPreview />
        </section>

        {/* Cómo funciona */}
        <section className="border-t border-hairline py-16">
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

        {/* Features */}
        <section className="grid gap-5 border-t border-hairline pt-16 sm:grid-cols-2">
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
