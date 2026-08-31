import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  Check,
  FileText,
  MessageCircle,
  PlayCircle,
  Sparkles,
  UserPlus,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { approxLocalPricesLabel } from "@/lib/pricing-display";
import { canonicalHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => {
    const canonical = canonicalHead("/");
    return {
      meta: [
        { title: "Alika · Software de gestión dental para LatAm" },
        {
          name: "description",
          content:
            "Menos ausencias, cobras mejor, sin planillas. Agenda, ficha clínica, odontograma y cobranza con recordatorios por WhatsApp. Prueba la demo sin registrarte.",
        },
        { property: "og:title", content: "Alika · La clínica dental entera, bajo control" },
        {
          property: "og:description",
          content:
            "Agenda, historia clínica, presupuestos y cobranza en un solo lugar. Hecho para clínicas de Latinoamérica. Prueba la demo sin registrarte.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
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
    { h: "10:30", n: "R. Fernández", t: "Ortodoncia", chip: "Por confirmar", tone: "wa" as const },
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
                marcados[n] ?? "border-hairline text-muted-foreground",
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
  "Exportas tus datos",
];

const dolores = [
  {
    icon: CalendarDays,
    t: "El paciente no vino y nadie lo llamó",
    d: "Cada silla vacía es plata que no vuelve. Los recordatorios a mano se te escapan.",
  },
  {
    icon: Wallet,
    t: "No sabes cuánto te deben",
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
    t: "Crea tu clínica",
    d: "Nombre, sucursal y equipo. Menos de 5 minutos, sin instalar nada.",
  },
  {
    n: 2,
    t: "Carga o importa",
    d: "Pacientes y agenda a mano, o subiendo tu planilla actual de un golpe.",
  },
  {
    n: 3,
    t: "Atiende y cobra",
    d: "Ficha, presupuestos, pagos y recordatorios por WhatsApp, conectados.",
  },
];

const faqs = [
  {
    q: "¿Es caro?",
    a: "Desde US$29/mes (Solo, 1 profesional) o US$69/mes (Clínica, hasta 3). Empiezas gratis 14 días sin tarjeta, y un solo paciente que no se te escapa al mes ya lo paga.",
  },
  {
    q: "¿Es complicado? No soy técnico.",
    a: "Si sabes usar WhatsApp, sabes usar Alika. Configuras tu clínica en una tarde, y puedes probar la demo ahora mismo sin registrarte.",
  },
  {
    q: "¿Mi equipo lo va a usar?",
    a: "Tu equipo ya vive en el celular y en WhatsApp. Alika trabaja ahí, no contra eso. Cada rol ve solo lo que le toca, simple.",
  },
  {
    q: "¿Y mis datos, mis pacientes?",
    a: "Son tuyos. Cifrados, con acceso por rol, y los exportas cuando quieras. Sin secuestro de datos.",
  },
  {
    q: "¿Y si no me sirve?",
    a: "Pruebas gratis, sin tarjeta. Si no te sirve, no pagas nada y te llevas tus datos. Sin letra chica.",
  },
];

// ── Página ──────────────────────────────────────────────────────────

function Landing() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <SiteHeader />

      <main id="main-content">
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          {/* Malla aurora + grano — definidos en styles.css, sin usar hasta
              ahora (auditoría de UI, 30-ago): la identidad visual más
              trabajada del sistema de diseño no llegaba a renderizarse
              nunca. Necesitan `relative overflow-hidden` para que su
              `position: absolute` se recorte contra el hero, Y `isolate`
              para crear un stacking context propio — si no, su z-index
              negativo escapa hasta el fondo de TODA la página (detrás del
              bg-background opaco del layout) y queda invisible aunque el
              elemento exista y tenga los colores correctos en el DOM. */}
          <div className="hero-aurora" aria-hidden="true" />
          <div className="hero-grain" aria-hidden="true" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[1fr_0.92fr] lg:gap-14">
            <div className="animate-rise-in">
              <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-mint/30 bg-mint-soft px-3 py-1 text-xs font-semibold text-mint-strong">
                <span className="size-1.5 rounded-full bg-mint" />
                Software de gestión dental · Latinoamérica
              </span>
              <h1 className="font-precise text-[2.9rem] font-extrabold leading-[0.95] text-balance sm:text-6xl lg:text-[4.25rem]">
                Menos ausencias.
                <br />
                <span className="relative inline-block text-mint-strong">
                  Cobras mejor.
                  <svg
                    viewBox="0 0 220 18"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    className="absolute -bottom-1.5 left-0 h-3 w-full"
                  >
                    <path
                      d="M2 12C40 2 90 2 110 8C130 14 180 16 218 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                      className="animate-swash"
                    />
                  </svg>
                </span>
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
                  Prueba la demo ahora
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </a>
                <Link
                  to="/auth"
                  className="rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
                >
                  Empieza gratis
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
          </div>
        </section>

        {/* El dolor */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-mint-strong">
              El problema
            </p>
            <h2 className="font-precise text-3xl font-bold leading-tight sm:text-4xl">
              Si tu clínica todavía corre en Excel, WhatsApp y cuadernos, ya sabes lo que se pierde.
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
                Pruébala tú mismo
              </p>
              <h2 className="font-precise text-3xl font-bold leading-tight sm:text-[2.75rem]">
                No te pedimos que nos creas. Entra y compruébalo.
              </h2>
              <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
                Una clínica de ejemplo, cargada y lista. Agenda un paciente, manda un recordatorio,
                carga un presupuesto. Sin formulario, sin llamada de ventas, sin dar tu mail.
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
                Lo que ganas
              </p>
              <h2 className="font-precise text-3xl font-bold sm:text-4xl">
                No son features. Son resultados.
              </h2>
            </div>

            <FeatureRow
              tag="Menos ausencias"
              title="El recordatorio que hoy haces a mano, automático."
              text="Cada cita dispara confirmación y recordatorio por WhatsApp. Menos sillas vacías, sin que nadie pierda la mañana mandando mensajes uno por uno."
              icon={CalendarDays}
              media={<MiniAgenda />}
            />
            <FeatureRow
              tag="Cobras mejor"
              title="Presupuestos, pagos y saldos, siempre a la vista."
              text="Sabes cuánto entró hoy y cuánto te deben, al instante. Presupuestos que se convierten en plan de tratamiento con un clic."
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
              text="Quien te escribe por primera vez queda guardado como contacto, no se pierde en el chat. La lista de espera y los presupuestos sin respuesta arman su propia cola — tú revisas y salen con un clic. Cada paciente tiene su código para invitar amigos."
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
              listos para la siguiente consulta. Alika se ocupa de lo repetitivo para que tú te
              ocupes de atender.
            </p>
            <div className="mt-6 rounded-xl border border-mint/25 bg-mint-soft p-4">
              {/* Newsreader (font-serif-display) — definida en el sistema de
                  diseño desde el rebrand pero sin ningún uso real todavía
                  (auditoría de UI, 30-ago). Un pull-quote es el lugar
                  clásico para un serif editorial: contraste tipográfico
                  sobre el grotesco del resto de la página. */}
              <p className="font-serif-display text-base italic leading-relaxed text-ink">
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
              Prueba 14 días gratis, sin tarjeta.
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-base text-muted-foreground">
              Sin cobro por sucursal. Las primeras clínicas quedan con este precio fundador de por
              vida — después de esta etapa, sube.
            </p>

            <div className="mx-auto mt-10 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="relative rounded-2xl border border-border bg-card p-6 pt-8 text-left">
                <span className="absolute -top-3 left-6 rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-foreground">
                  Precio de por vida
                </span>
                <p className="text-sm font-semibold">Alika Solo</p>
                <p className="text-xs text-muted-foreground">1 profesional / 1 sillón</p>
                <p className="mt-3 text-3xl font-bold">
                  US$29<span className="text-sm font-normal text-muted-foreground">/mes</span>
                </p>
                <p className="text-sm text-muted-foreground line-through">US$49/mes</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {approxLocalPricesLabel(29)}{" "}
                  <span className="italic">(referencial, el cobro es en USD)</span>
                </p>
              </div>
              <div className="relative rounded-2xl border-2 border-mint-strong bg-mint-soft p-6 pt-8 text-left">
                <span className="absolute -top-3 left-6 rounded-full bg-mint-strong px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-mint-soft">
                  Precio de por vida
                </span>
                <p className="text-sm font-semibold">Alika Clínica</p>
                {/* text-ink/70 en vez de text-muted-foreground: sobre bg-mint-soft el
                    muted-foreground estándar caía a 4.29:1, debajo del 4.5:1 de WCAG AA. */}
                <p className="text-xs text-ink/70">Hasta 3 profesionales / sillones</p>
                <p className="mt-3 text-3xl font-bold">
                  US$69<span className="text-sm font-normal text-ink/70">/mes</span>
                </p>
                <p className="text-sm text-ink/70 line-through">US$99/mes</p>
                <p className="mt-1 text-xs text-ink/70">
                  {approxLocalPricesLabel(69)}{" "}
                  <span className="italic">(referencial, el cobro es en USD)</span>
                </p>
              </div>
            </div>
            <p className="mx-auto mt-5 max-w-lg text-xs text-muted-foreground">
              No es un descuento por tiempo limitado — es el precio que pagás mientras seas cliente.
              Quienes se sumen después de esta etapa pagan el precio de lista.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/auth"
                className="rounded-xl bg-ink px-6 py-3.5 text-sm font-semibold text-ink-foreground transition-opacity hover:opacity-90"
              >
                Empieza gratis
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

        {/* CTA final */}
        <section>
          <div className="mx-auto max-w-3xl px-6 py-20 text-center">
            <h2 className="font-precise text-3xl font-bold leading-tight sm:text-5xl">
              Ordena tu clínica de una vez.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-base text-muted-foreground">
              Entra a la demo ahora, sin dar tu mail. O crea tu clínica gratis en 5 minutos.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="/demo"
                className="group flex items-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-semibold text-ink-foreground shadow-lg shadow-ink/20 transition-all hover:-translate-y-0.5"
              >
                Prueba la demo ahora
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <Link
                to="/auth"
                className="rounded-xl border border-border bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                Empieza gratis
              </Link>
              {/* TODO(walter): sin número de WhatsApp real documentado en el
                  repo, este botón cae al mailto de contacto como fallback
                  consciente. Cuando haya un número de soporte, reemplazar por
                  buildWaMeUrl(...) (src/lib/messaging.ts) para abrir wa.me. */}
              <a
                href="mailto:maxnovaluciglobal@gmail.com"
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                <MessageCircle className="size-4" />
                Escríbenos por WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
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
    <div className="grid min-w-0 items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className={cn("min-w-0", flip && "lg:order-2")}>
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mint-strong">
          <Icon className="size-4" />
          {tag}
        </p>
        <h3 className="font-precise text-2xl font-bold leading-snug sm:text-3xl">{title}</h3>
        <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">{text}</p>
      </div>
      {/* min-w-0: sin esto, el track de grid en mobile (una sola columna) se
          expandía al ancho intrínseco de la fila WhatsApp con el teléfono
          "+56 9 5555 1234" sin truncar, generando overflow horizontal en toda
          la página (scrollWidth 433px en viewport de 375px). */}
      <div className={cn("min-w-0", flip && "lg:order-1")}>{media}</div>
    </div>
  );
}
