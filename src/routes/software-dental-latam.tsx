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
 * Alika NO hace todavía: no existe facturación electrónica por país (ni DTE,
 * ni CFDI, ni equivalentes). Está en el roadmap, sin fecha: decirlo así y no
 * insinuar que ya existe, porque eso quema la confianza en la primera llamada
 * de ventas. Si algún día se compromete una fecha, recién ahí se publica.
 */

/** Monedas que no usan decimales — mismo criterio que finance.ts. */
const SIN_DECIMALES = new Set(["CLP", "COP", "PYG"]);

const NOTA_POR_PAIS: Record<string, string> = {
  CL: "El peso chileno no usa decimales: $45.000 se escribe y se cobra como 45.000.",
  MX: "El peso mexicano sí lleva centavos, y Alika los trata como centavos de verdad en toda la cadena de cobro.",
  CO: "El peso colombiano no usa decimales, igual que el chileno.",
  PE: "El sol lleva céntimos: S/ 180,50 queda en S/ 180,50, sin redondeos que descuadren la caja.",
  AR: "El peso argentino lleva centavos y Alika los respeta. Los montos grandes no se redondean ni se descuadran al sumar.",
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
    a: "Todavía no. Alika registra cobros, saldos, medios de pago con su retención y comisiones de profesionales, pero hoy no emite documentos tributarios electrónicos en ningún país. La facturación electrónica está en el roadmap, sin fecha comprometida. Mientras tanto, si necesitas emitirlos, sigues usando tu sistema de facturación.",
  },
  {
    q: "¿Los montos se manejan bien en monedas sin decimales?",
    a: "Sí, y es una diferencia que importa. En pesos chilenos o colombianos, un sistema que trata el monto como si tuviera centavos puede equivocarse por 100 veces. Alika sabe qué monedas llevan decimales y cuáles no, y cada cobro queda registrado con su moneda, así que un descuido no pasa inadvertido.",
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
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Software dental para clínicas de Latinoamérica
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Alika es un sistema de gestión para clínicas dentales chicas y medianas: agenda, ficha
          clínica, odontograma, presupuestos, cobranza y WhatsApp en un solo lugar. Al crear tu
          clínica eliges el país, y con eso quedan definidas la moneda y la zona horaria con las que
          trabaja todo el sistema.
        </p>

        <section className="mt-12">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Países con alta guiada
          </h2>
          <div className="mt-4 space-y-3">
            {COUNTRIES.map((pais) => (
              <div key={pais.code} className="rounded-lg border border-hairline p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-display font-semibold text-foreground">{pais.label}</h3>
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
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Lo mismo en los cinco
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">Agenda en hora local.</strong> Cada sucursal
              guarda su propia zona horaria, así que una clínica con sedes en dos ciudades no ve las
              citas corridas.
            </li>
            <li>
              <strong className="text-foreground">WhatsApp sin configurar nada.</strong> Alika arma
              la lista de recordatorios y tu equipo los envía con un toque, desde su propio WhatsApp
              o desde el número de la clínica si lo conectas. Ningún mensaje a pacientes sale solo.
              La única excepción: si conectas tu número, Alika saluda automáticamente a quien
              escribe por primera vez.
            </li>
            <li>
              <strong className="text-foreground">Sigue funcionando sin internet.</strong> Agenda,
              fichas, cobros y odontograma quedan guardados en el equipo y se sincronizan solos.
            </li>
            <li>
              <strong className="text-foreground">Los montos no se redondean mal.</strong> Alika
              sabe si tu moneda lleva decimales y cada cobro queda registrado con su moneda.
            </li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Lo que Alika no hace
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Alika{" "}
            <strong className="text-foreground">
              todavía no emite documentos tributarios electrónicos
            </strong>{" "}
            en ningún país: ni boleta ni factura electrónica en Chile, ni CFDI en México, ni sus
            equivalentes. Registra cobros, saldos, medios de pago con su retención y comisiones de
            profesionales, pero la emisión fiscal sigue en el sistema que ya uses. La facturación
            electrónica está en el roadmap, sin fecha comprometida. Preferimos decirlo aquí y no en
            la primera llamada.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Preguntas frecuentes
          </h2>
          <dl className="mt-4 space-y-6">
            {PREGUNTAS.map((p) => (
              <div key={p.q}>
                <dt className="font-semibold text-foreground">{p.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="mt-12 text-sm text-muted-foreground">
          Puedes{" "}
          <Link to="/demo" className="text-brand-700 underline underline-offset-2">
            entrar a la demo
          </Link>{" "}
          (solo te pedimos nombre y email, sin tarjeta ni contraseña) o mirar el{" "}
          <Link to="/faq" className="text-brand-700 underline underline-offset-2">
            resto de las preguntas frecuentes
          </Link>
          .
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          ¿Quieres saber cuánto estás perdiendo hoy? Calcula la{" "}
          <Link
            to="/calculadora-rentabilidad-dental"
            className="text-brand-700 underline underline-offset-2"
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
