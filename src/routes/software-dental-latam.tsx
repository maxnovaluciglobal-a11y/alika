import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { canonicalHead, faqJsonLdScript } from "@/lib/seo";
import { COUNTRIES } from "@/lib/onboarding-types";

/**
 * Página de posicionamiento por país ("software dental LatAm").
 *
 * Regla que se sigue acá: **no prometer nada que el producto no haga.** Los
 * datos por país (moneda, huso, si la moneda lleva decimales) salen de
 * `COUNTRIES` y de `ZERO_DECIMAL_CURRENCIES` en `finance.ts`, no de una lista
 * escrita a mano que se desincroniza. Y hay una sección explícita de lo que
 * Alika NO hace: no existe facturación electrónica por país (ni DTE, ni CFDI,
 * ni equivalentes), y una página de captación que lo insinúe quema la
 * confianza en la primera llamada de ventas.
 */

/** Monedas que no usan decimales — mismo criterio que finance.ts. */
const SIN_DECIMALES = new Set(["CLP", "COP", "PYG"]);

const NOTA_POR_PAIS: Record<string, string> = {
  CL: "El peso chileno no usa decimales: $45.000 se escribe y se cobra como 45.000, sin centavos fantasma.",
  MX: "El peso mexicano sí lleva centavos, y Alika los trata como centavos de verdad en toda la cadena de cobro.",
  CO: "El peso colombiano no usa decimales, igual que el chileno.",
  PE: "El sol lleva céntimos. Los montos se guardan en la unidad mínima, no en un decimal flotante.",
  AR: "El peso argentino lleva centavos. Los importes se guardan en enteros para que la inflación no arrastre errores de redondeo.",
};

const PREGUNTAS = [
  {
    q: "¿Alika sirve para una clínica dental fuera de Chile?",
    a: "Sí. Al crear la clínica eliges el país, y con eso quedan configurados la moneda y la zona horaria. Hoy el alta guiada cubre Chile, México, Colombia, Perú y Argentina.",
  },
  {
    q: "¿La agenda usa la hora de mi país o la del servidor?",
    a: "La de tu país. Cada clínica guarda su zona horaria y la agenda, los recordatorios y los reportes se calculan con esa hora local, no con la del servidor.",
  },
  {
    q: "¿Alika emite factura electrónica en mi país?",
    a: "No. Alika registra cobros, saldos, medios de pago con su retención y comisiones de profesionales, pero no emite documentos tributarios electrónicos en ningún país. Si necesitas emitirlos, tienes que seguir usando tu sistema de facturación.",
  },
  {
    q: "¿Los montos se manejan bien en monedas sin decimales?",
    a: "Sí, y es una diferencia que importa. En pesos chilenos o colombianos, tratar el monto como si tuviera centavos produce errores de 100 veces. Alika guarda cada importe en la unidad mínima de su moneda y la moneda es obligatoria en cada registro, para que un descuido no pase inadvertido.",
  },
  {
    q: "¿Puedo tener sucursales en más de una ciudad?",
    a: "Sí. Cada sucursal tiene su propia zona horaria, sus boxes y sus horarios de atención, y la agenda respeta los de la sucursal donde ocurre la cita.",
  },
  {
    q: "¿Funciona si la conexión de la clínica es mala?",
    a: "Sigues atendiendo sin internet: agenda, fichas, cobros, notas y odontograma quedan guardados en el equipo y se sincronizan solos cuando vuelve la conexión. Lo que sí necesita conexión es mandar WhatsApp, y la app lo avisa en el momento.",
  },
];

export const Route = createFileRoute("/software-dental-latam")({
  head: () => {
    const canonical = canonicalHead("/software-dental-latam");
    const titulo = "Software dental para Latinoamérica · Alika";
    const descripcion =
      "Software de gestión para clínicas dentales en Chile, México, Colombia, Perú y Argentina: moneda y zona horaria de tu país, agenda, ficha clínica, odontograma, cobranza y WhatsApp.";
    return {
      meta: [
        { title: titulo },
        { name: "description", content: descripcion },
        { property: "og:title", content: titulo },
        { property: "og:description", content: descripcion },
        { property: "og:type", content: "website" },
        ...canonical.meta,
      ],
      links: canonical.links,
      scripts: faqJsonLdScript(PREGUNTAS),
    };
  },
  component: SoftwareDentalLatam,
});

function SoftwareDentalLatam() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-precise text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Software dental para clínicas de Latinoamérica
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Alika es un sistema de gestión para clínicas dentales chicas y medianas: agenda, ficha
          clínica, odontograma, presupuestos, cobranza y WhatsApp en un solo lugar. Al crear tu
          clínica eliges el país, y con eso quedan definidas la moneda y la zona horaria con las que
          trabaja todo el sistema.
        </p>

        <section className="mt-12">
          <h2 className="font-precise text-sm font-bold uppercase tracking-wider text-ink/60">
            Países con alta guiada
          </h2>
          <div className="mt-4 space-y-3">
            {COUNTRIES.map((pais) => (
              <div key={pais.code} className="rounded-lg border border-hairline p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-precise font-semibold text-ink">{pais.label}</h3>
                  <span className="text-xs text-muted-foreground">
                    {pais.currency} · {pais.timezone}
                    {SIN_DECIMALES.has(pais.currency) ? " · moneda sin decimales" : ""}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {NOTA_POR_PAIS[pais.code]}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-precise text-sm font-bold uppercase tracking-wider text-ink/60">
            Lo mismo en los cinco
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-ink">Agenda en hora local.</strong> Cada sucursal guarda su
              propia zona horaria, así que una clínica con sedes en dos ciudades no ve las citas
              corridas.
            </li>
            <li>
              <strong className="text-ink">WhatsApp sin obligación de conectar nada.</strong> Alika
              arma la cola de recordatorios y tu equipo la despacha. Si conectas tu número, el envío
              sale por la API; si no, por un link de wa.me. Ningún recordatorio ni mensaje de
              seguimiento sale solo: los dispara siempre alguien de tu clínica. La única excepción
              es un saludo automático la primera vez que escribe alguien que todavía no es paciente
              tuyo — y sólo si conectaste tu número.
            </li>
            <li>
              <strong className="text-ink">Sigue funcionando sin internet.</strong> Agenda, fichas,
              cobros y odontograma quedan guardados en el equipo y se sincronizan solos.
            </li>
            <li>
              <strong className="text-ink">Los montos no se redondean mal.</strong> Cada importe se
              guarda en la unidad mínima de su moneda y la moneda es obligatoria en cada registro.
            </li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="font-precise text-sm font-bold uppercase tracking-wider text-ink/60">
            Lo que Alika no hace
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Alika <strong className="text-ink">no emite documentos tributarios electrónicos</strong>{" "}
            en ningún país: ni boleta ni factura electrónica en Chile, ni CFDI en México, ni sus
            equivalentes. Registra cobros, saldos, medios de pago con su retención y comisiones de
            profesionales, pero la emisión fiscal sigue en el sistema que ya uses. Preferimos
            decirlo acá y no en la primera llamada.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-precise text-sm font-bold uppercase tracking-wider text-ink/60">
            Preguntas frecuentes
          </h2>
          <dl className="mt-4 space-y-6">
            {PREGUNTAS.map((p) => (
              <div key={p.q}>
                <dt className="font-semibold text-ink">{p.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="mt-12 text-sm text-muted-foreground">
          Puedes{" "}
          <Link to="/demo" className="text-mint-strong underline underline-offset-2">
            probar la demo sin registrarte
          </Link>
          , mirar el{" "}
          <Link to="/faq" className="text-mint-strong underline underline-offset-2">
            resto de las preguntas frecuentes
          </Link>{" "}
          o calcular la{" "}
          <Link
            to="/calculadora-rentabilidad-dental"
            className="text-mint-strong underline underline-offset-2"
          >
            rentabilidad de tu clínica
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
