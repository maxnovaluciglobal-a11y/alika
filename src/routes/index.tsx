import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oralia · Software de gestión dental para LatAm" },
      {
        name: "description",
        content:
          "Oralia unifica agenda, pacientes, historia clínica y finanzas de tu clínica dental con inteligencia artificial y acceso por roles.",
      },
      { property: "og:title", content: "Oralia · Software de gestión dental para LatAm" },
      {
        property: "og:description",
        content: "Agenda, pacientes, historia clínica y finanzas en un solo lugar, con IA y roles por equipo.",
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
  },
  {
    icon: Stethoscope,
    title: "Ficha clínica viva",
    text: "Timeline por paciente, tratamientos y saldos siempre sincronizados.",
  },
  {
    icon: ShieldCheck,
    title: "Roles y permisos reales",
    text: "Doctor, recepción, administración y contabilidad ven solo lo que les toca.",
  },
  {
    icon: Sparkles,
    title: "Asistente con IA",
    text: "Resúmenes clínicos y sugerencias para llenar huecos de agenda.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-brand">
            <span className="size-4 rounded-full border-2 border-brand-foreground" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-brand">Oralia</span>
        </span>
        <div className="flex items-center gap-2">
          <Link
            to="/portal"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Portal paciente
          </Link>
          <Link
            to="/auth"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90"
          >
            Entrar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="py-16 sm:py-24">
          <p className="mb-4 inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
            Gestión dental moderna para Latinoamérica
          </p>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            La clínica dental completa, en una sola pantalla.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Agenda, pacientes, historia clínica, tratamientos y finanzas con control de acceso por rol y un
            asistente de IA que trabaja contigo.
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
          </div>
        </section>

        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="card-clinical p-6">
              <Icon className="mb-3 size-5 text-brand" />
              <h2 className="mb-1.5 font-display text-base font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">{text}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
