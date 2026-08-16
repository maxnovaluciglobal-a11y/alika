import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  Check,
  FileText,
  Lock,
  MessageCircle,
  PlayCircle,
  Sparkles,
  UserPlus,
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
          "Menos ausencias, cobrás mejor, sin planillas. Agenda, ficha clínica, odontograma y cobranza con recordatorios por WhatsApp. Probá la demo sin registrarte.",
      },
      { property: "og:title", content: "Alika · La clínica dental entera, bajo control" },
      {
        property: "og:description",
        content:
          "Agenda, historia clínica, presupuestos y cobranza en un solo lugar. Hecho para clínicas de Latinoamérica. Probá la demo sin registrarte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

// ── Fragmentos de producto ──────────────────────────────────────────

function CardChrome({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-hairline bg-secondary/50 px-4 py-2.5">
      <span className="size-2.5 rounded-full bg-border" />
      <span className="size-2.5 rounded-full bg-border" />
      <span className="size-2.5 rounded-full bg-border" />
      <span className="ml-2 text-[11px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function MiniAgenda() {
  const filas = [
    { h: "09:00", n: "P. González", t: "Control", chip: "Confirmada", tone: "ok" as const },
    { h: "10:30", n: "R. Fernández", t: "Ortodoncia", chip: "Recordado", tone: "wa" as const },
    { h: "11:15", n: "M. Silva", t: "Endodoncia", chip: "En sala", tone: "sala" as const },
  ];
  const tones = {
    ok: "bg-mint-soft text-mint-strong",
    wa: "bg-mint-soft text-mint-strong",
    sala: "bg-ink/10 text-ink",
  };
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-card">
      <CardChrome label="Agenda · hoy" />
      <div className="divide-y divide-hairline">
        {filas.map((f) => (
          <div key={f.h} className="flex items-center gap-3 px-4 py-2.5">
            <span className="font-mono text-[11px] text-muted-foreground">{f.h}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{f.n}</p>
              <p className="truncate text-[11px] text-muted-foreground">{f.t}</p>
            </div>
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", tones[f.tone])}>
              {f.chip}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniCaja() {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-card">
      <CardChrome label="Caja · hoy" />
      <div className="border-b border-hairline px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Cobrado hoy
        </p>
        <p className="font-precise text-2xl font-bold text-mint-strong">{clp.format(275000)}</p>
      </div>
      <div className="flex items-center justify-between px-4 py-2.5 text-xs">
        <span className="text-muted-foreground">Por cobrar</span>
        <span className="font-medium">{clp.format(180000)}</span>
      </div>
      <div className="flex items-center justify-between border-t border-hairline px-4 py-2.5 text-xs">
        <span className="text-muted-foreground">Débito · Efectivo · Transferencia</span>
        <span className="font-medium text-mint-strong">8 pagos</span>
      </div>
    </div>
  );
}

const dientesFDI = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
function MiniOdontograma() {
  const marcados: Record<number, string> = {
    14: "border-ink bg-ink/10",
    16: "border-mint bg-mint-soft",
    26: "border-mint bg-mint-soft",
  };
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-card">
      <CardChrome label="Ficha · odontograma FDI" />
      <div className="px-4 py-4">
        <div className="flex flex-wrap gap-1">
          {dientesFDI.map((n) => (
            <span
              key={n}
              className={cn(
                "grid size-6 place-items-center rounded-[5px] border text-[9px] font-medium tabular-nums",
                marcados[n] ?? "border-hairline text-muted-foreground/60",
              )}
            >
              {n}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Timeline, tratamientos y saldos por paciente — siempre sincronizados.
        </p>
      </div>
    </div>
  );
}

function MiniWhatsAppOps() {
  const filas = [
    {
      icon: UserPlus,
      n: "+56 9 5555 1234",
      t: "Te escribió por primera vez",
      chip: "Lead nuevo",
      tone: "lead" as const,
    },
    {
      icon: CalendarDays,
      n: "Lista de espera",
      t: "3 pacientes calzan con el hueco del jueves",
      chip: "Para avisar",
      tone: "wa" as const,
    },
    {
      icon: Wallet,
      n: "R. Fernández",
      t: "Presupuesto enviado hace 7 días, sin respuesta",
      chip: "Seguimiento",
      tone: "wa" as const,
    },
  ];
  const tones = {
    wa: "bg-mint-soft text-mint-strong",
    lead: "bg-ink/10 text-ink",
  };
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-card">
      <CardChrome label="WhatsApp · para revisar" />
      <div className="divide-y divide-hairline">
        {filas.map((f) => (
          <div key={f.n} className="flex items-center gap-3 px-4 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
              <f.icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{f.n}</p>
              <p className="truncate text-[11px] text-muted-foreground">{f.t}</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                tones[f.tone],
              )}
            >
              {f.chip}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Datos de secciones ──────────────────────────────────────────────

const trust = [
  "Sin instalar nada",
  "Datos cifrados",
  "Hecho para LatAm",
  "WhatsApp integrado",
  "Exportás tus datos",
];

const dolores = [
  {
    icon: CalendarDays,
    t: "El paciente no vino y nadie lo llamó",
    d: "Cada silla vacía es plata que no vuelve. Los recordatorios a mano se te escapan.",
  },
  {
    icon: Wallet,
    t: "No sabés cuánto te deben",
    d: "Presupuestos en papelitos, pagos sueltos. La cobranza vive en tu cabeza.",
  },
  {
    icon: FileText,
    t: "La historia clínica en cuadernos",
    d: "Si se moja, se pierde, o el paciente cambia de sede — adiós al historial.",
  },
  {
    icon: MessageCircle,
    t: "Alguien pierde horas en WhatsApp",
    d: "Confirmar cita por cita, a mano, uno por uno. Todos los días.",
  },
];

const pasos = [
  {
    n: 1,
    t: "Creá tu clínica",
    d: "Nombre, sucursal y equipo. Menos de 5 minutos, sin instalar nada.",
  },
  {
    n: 2,
    t: "Cargá o importá",
    d: "Pacientes y agenda a mano, o subiendo tu planilla actual de un golpe.",
  },
  {
    n: 3,
    t: "Atendé y cobrá",
    d: "Ficha, presupuestos, pagos y recordatorios por WhatsApp, conectados.",
  },
];

const faqs = [
  {
    q: "¿Es caro?",
    a: "Empezás gratis, sin tarjeta. Y un solo paciente que no se te escapa al mes ya paga Alika. Estamos con precio fundador para las primeras clínicas.",
  },
  {
    q: "¿Es complicado? No soy técnico.",
    a: "Si sabés usar WhatsApp, sabés usar Alika. Configurás tu clínica en una tarde, y podés probar la demo ahora mismo sin registrarte.",
  },
  {
    q: "¿Mi equipo lo va a usar?",
    a: "Tu equipo ya vive en el celular y en WhatsApp. Alika trabaja ahí, no contra eso. Cada rol ve solo lo que le toca, simple.",
  },
  {
    q: "¿Y mis datos, mis pacientes?",
    a: "Son tuyos. Cifrados, con acceso por rol, y los exportás cuando quieras. Sin secuestro de datos.",
  },
  {
    q: "¿Y si no me sirve?",
    a: "Probás gratis, sin tarjeta. Si no te sirve, no pagás nada y te llevás tus datos. Sin letra chica.",
  },
];

// ── Página ──────────────────────────────────────────────────────────

function Landing() {
  return (
    <div className="min-h-screen bg-background text-ink">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <span className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-ink">
              <span className="size-3.5 rounded-full border-2 border-mint" />
            </span>
            <span className="font-precise text-xl font-bold tracking-tight text-ink">Alika</span>
          </span>
          <div className="flex items-center gap-1.5">
            <a
              href="/demo"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-ink"
            >
              Ver demo
            </a>
            <Link
              to="/auth"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-ink sm:block"
            >
              Entrar
            </Link>
            <Link
              to="/auth"
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-ink-foreground transition-opacity hover:opacity-90"
            >
              Empezá gratis
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[1fr_0.92fr] lg:gap-14">
          <div className="animate-rise-in">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-mint/30 bg-mint-soft px-3 py-1 text-xs font-semibold text-mint-strong">
              <span className="size-1.5 rounded-full bg-mint" />
              Software de gestión dental · Latinoamérica
            </span>
            <h1 className="font-precise text-[2.9rem] font-extrabold leading-[0.95] text-balance sm:text-6xl lg:text-[4.25rem]">
              Menos ausencias.
              <br />
              <span className="text-mint-strong">Cobrás mejor.</span>
              <br />
              Sin planillas.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Agenda, historia clínica, odontograma y cobranza en un solo lugar. Con recordatorios
              por WhatsApp automáticos.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="/demo"
                className="group flex items-center gap-2 rounded-xl bg-ink px-5 py-3.5 text-sm font-semibold text-ink-foreground shadow-lg shadow-ink/20 transition-all hover:-translate-y-0.5 hover:shadow-xl"
              >
                Probá la demo ahora
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <Link
                to="/auth"
                className="rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                Empezá gratis
              </Link>
            </div>
            <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-mint-strong" /> Sin registro
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-mint-strong" /> Sin tarjeta
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-mint-strong" /> Tus datos son tuyos
              </span>
            </p>
          </div>

          {/* Foto + producto flotante (hero híbrido) */}
          <div className="relative animate-rise-in [animation-delay:120ms]">
            <div className="overflow-hidden rounded-2xl border border-border shadow-2xl shadow-ink/15">
              <img
                src="/landing/dentist.jpg"
                alt="Dentista atendiendo a un paciente en su consultorio"
                width={1280}
                height={853}
                className="aspect-[4/3] w-full object-cover"
                loading="eager"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 w-52 rotate-[-2deg]">
              <MiniCaja />
            </div>
            <div className="absolute -right-4 -top-4 hidden rounded-xl border border-hairline bg-card px-3 py-2 shadow-xl shadow-ink/10 sm:block">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-mint-soft text-mint-strong">
                  <MessageCircle className="size-3.5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold leading-tight">Recordatorio enviado</p>
                  <p className="text-[10px] text-muted-foreground">Rocío · mañana 10:30</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* El dolor */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-mint-strong">
              El problema
            </p>
            <h2 className="font-precise text-3xl font-bold leading-tight sm:text-4xl">
              Si tu clínica todavía corre en Excel, WhatsApp y cuadernos, ya sabés lo que se pierde.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {dolores.map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex gap-4 rounded-2xl border border-hairline bg-card p-6">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-bone text-ink">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="mb-1 font-semibold">{t}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Demo protagónica — banda oscura (momento de drama) */}
        <section>
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-mint-strong">
                Probala vos
              </p>
              <h2 className="font-precise text-3xl font-bold leading-tight sm:text-[2.75rem]">
                No te pedimos que nos creas. Entrá y comprobalo.
              </h2>
              <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
                Una clínica de ejemplo, cargada y lista. Agendá un paciente, mandá un recordatorio,
                cargá un presupuesto. Sin formulario, sin llamada de ventas, sin dar tu mail.
              </p>
              <a
                href="/demo"
                className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-semibold text-ink-foreground shadow-lg shadow-ink/20 transition-all hover:-translate-y-0.5"
              >
                <PlayCircle className="size-4" />
                Entrar a la demo
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
            <div className="rotate-1">
              <MiniAgenda />
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 max-w-xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-mint-strong">
              Cómo funciona
            </p>
            <h2 className="font-precise text-3xl font-bold sm:text-4xl">
              De cero a tu primera cita agendada, hoy mismo.
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {pasos.map(({ n, t, d }) => (
              <div key={n}>
                <span className="mb-4 grid size-11 place-items-center rounded-full bg-ink font-precise text-base font-bold text-mint">
                  {n}
                </span>
                <h3 className="mb-1.5 text-lg font-semibold">{t}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features por resultado */}
        <section>
          <div className="mx-auto max-w-6xl space-y-16 px-6 py-20">
            <div className="max-w-xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-mint-strong">
                Lo que ganás
              </p>
              <h2 className="font-precise text-3xl font-bold sm:text-4xl">
                No son features. Son resultados.
              </h2>
            </div>

            <FeatureRow
              tag="Menos ausencias"
              title="El recordatorio que hoy hacés a mano, automático."
              text="Cada cita dispara confirmación y recordatorio por WhatsApp. Menos sillas vacías, sin que nadie pierda la mañana mandando mensajes uno por uno."
              icon={CalendarDays}
              media={<MiniAgenda />}
            />
            <FeatureRow
              tag="Cobrás mejor"
              title="Presupuestos, pagos y saldos, siempre a la vista."
              text="Sabés cuánto entró hoy y cuánto te deben, al instante. Presupuestos que se convierten en plan de tratamiento con un clic."
              icon={Wallet}
              media={<MiniCaja />}
              flip
            />
            <FeatureRow
              tag="Todo en un lugar"
              title="Historia clínica y odontograma, digitales y vivos."
              text="Ficha por paciente con timeline, odontograma FDI, tratamientos y saldos. Accesible desde cualquier lado, con permisos por rol."
              icon={FileText}
              media={<MiniOdontograma />}
            />
            <FeatureRow
              tag="Tu WhatsApp no se duerme"
              title="Nadie que te escribe se pierde. Nadie que quedó pendiente, se olvida."
              text="Quien te escribe por primera vez queda guardado como contacto, no se pierde en el chat. La lista de espera y los presupuestos sin respuesta arman su propia cola — vos revisás y salen con un clic. Cada paciente tiene su código para invitar amigos."
              icon={MessageCircle}
              media={<MiniWhatsAppOps />}
              flip
            />
          </div>
        </section>

        {/* Resultado humano + IA */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-border shadow-xl shadow-ink/10">
            <img
              src="/landing/patient.jpg"
              alt="Paciente sonriendo con su resultado en el consultorio"
              width={1100}
              height={733}
              className="aspect-[3/2] w-full object-cover"
              loading="lazy"
            />
          </div>
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mint-strong">
              <Sparkles className="size-4" /> Asistente con IA
            </p>
            <h2 className="font-precise text-3xl font-bold leading-tight sm:text-4xl">
              Menos trabajo administrativo. Más tiempo con el paciente.
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
              Cada nota clínica se resume con un clic — hallazgos, procedimiento y próximo paso,
              listos para la siguiente consulta. Alika se ocupa de lo repetitivo para que vos te
              ocupes de atender.
            </p>
            <div className="mt-6 rounded-xl border border-mint/25 bg-mint-soft p-4">
              <p className="text-sm leading-relaxed text-ink">
                “Control de ortodoncia. Ajuste de arco superior, sin molestias referidas. Próximo
                control en 4 semanas.”
              </p>
              <p className="mt-2 text-[11px] font-semibold text-mint-strong">Resumido con IA</p>
            </div>
          </div>
        </section>

        {/* Precio / prueba */}
        <section>
          <div className="mx-auto max-w-3xl px-6 py-20 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-mint-strong">
              Precio fundador
            </p>
            <h2 className="font-precise text-3xl font-bold sm:text-4xl">
              Probá 14 días gratis. Sin tarjeta.
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-base text-muted-foreground">
              Estamos tomando las primeras clínicas con precio fundador y soporte directo. Empezás
              gratis hoy y, si te sirve, fijamos el precio juntos.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/auth"
                className="rounded-xl bg-ink px-6 py-3.5 text-sm font-semibold text-ink-foreground transition-opacity hover:opacity-90"
              >
                Empezá gratis
              </Link>
              <a
                href="/demo"
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                <PlayCircle className="size-4 text-mint-strong" />
                Ver la demo primero
              </a>
            </div>
          </div>
        </section>

        {/* Objeciones */}
        <section className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="mb-10 font-precise text-3xl font-bold sm:text-4xl">
            Las dudas de siempre.
          </h2>
          <div className="space-y-2">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl bg-secondary/40 px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Fundador */}
        <section className="mx-auto max-w-3xl px-6 pb-20">
          <div className="rounded-3xl border border-hairline bg-card p-8 sm:p-10">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink font-precise text-lg font-bold text-mint">
                W
              </span>
              <div>
                <p className="text-base leading-relaxed text-ink">
                  “Soy Walter. Hice Alika porque vi clínicas ahogadas en planillas y recordatorios a
                  mano. Está pensado para cómo se trabaja acá, en LatAm. Si lo probás y algo te
                  traba, escribime — te respondo yo.”
                </p>
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  Walter · fundador de Alika
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section>
          <div className="mx-auto max-w-3xl px-6 py-20 text-center">
            <h2 className="font-precise text-3xl font-bold leading-tight sm:text-5xl">
              Ordená tu clínica de una vez.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-base text-muted-foreground">
              Entrá a la demo ahora, sin dar tu mail. O creá tu clínica gratis en 5 minutos.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="/demo"
                className="group flex items-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-semibold text-ink-foreground shadow-lg shadow-ink/20 transition-all hover:-translate-y-0.5"
              >
                Probá la demo ahora
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <Link
                to="/auth"
                className="rounded-xl border border-border bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                Empezá gratis
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <span className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-ink">
              <span className="size-3 rounded-full border-2 border-mint" />
            </span>
            <span className="font-precise font-bold text-ink">Alika</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            Software de gestión dental · Hecho para Latinoamérica
            <Lock className="size-3" /> tus datos son tuyos
          </span>
        </div>
      </footer>
    </div>
  );
}

function FeatureRow({
  tag,
  title,
  text,
  icon: Icon,
  media,
  flip,
}: {
  tag: string;
  title: string;
  text: string;
  icon: typeof CalendarDays;
  media: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className={cn(flip && "lg:order-2")}>
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mint-strong">
          <Icon className="size-4" />
          {tag}
        </p>
        <h3 className="font-precise text-2xl font-bold leading-snug sm:text-3xl">{title}</h3>
        <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">{text}</p>
      </div>
      <div className={cn(flip && "lg:order-1")}>{media}</div>
    </div>
  );
}
