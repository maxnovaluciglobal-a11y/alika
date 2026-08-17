import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Preguntas frecuentes · Alika" },
      {
        name: "description",
        content:
          "Respuestas sobre cómo funciona Alika: empezar, WhatsApp, portal de pacientes, tus datos y precio.",
      },
    ],
  }),
  component: Faq,
});

const grupos: { t: string; items: { q: string; a: string }[] }[] = [
  {
    t: "General",
    items: [
      {
        q: "¿Qué es Alika?",
        a: "Un software de gestión para clínicas dentales: agenda, ficha clínica, odontograma, presupuestos, cobranza y WhatsApp integrado, todo en un solo lugar.",
      },
      {
        q: "¿Para qué tamaño de clínica está pensado?",
        a: "Para clínicas chicas y medianas de Latinoamérica — desde un dentista solo hasta un equipo de varios profesionales y varias sucursales.",
      },
      {
        q: "¿Necesito instalar algo?",
        a: "No. Alika se usa desde el navegador en computadora o celular, sin instalar nada.",
      },
      {
        q: "¿Qué pasa si se corta internet en la clínica?",
        a: "La información que ya estabas viendo (agenda del día, fichas de tus pacientes) se sigue mostrando, así que puedes consultarla durante el corte. Por ahora los cambios sí necesitan conexión: la app te avisa con un aviso visible cuando no puede guardar, para que nada quede a medias sin que te enteres.",
      },
    ],
  },
  {
    t: "Empezar",
    items: [
      {
        q: "¿Cómo empiezo?",
        a: 'Puedes probar la demo sin registrarte desde el botón "Ver demo", o crear tu clínica gratis en unos minutos con "Empieza gratis".',
      },
      {
        q: "¿Puedo importar los pacientes que ya tengo?",
        a: "Sí, hay un importador de pacientes y citas por CSV para no tener que cargar todo a mano.",
      },
      {
        q: "¿Cuánto tarda el onboarding?",
        a: "El alta de una clínica nueva es un flujo guiado de 3 pasos. Después de eso ya puedes cargar pacientes y agendar.",
      },
    ],
  },
  {
    t: "WhatsApp",
    items: [
      {
        q: "¿Cómo funcionan los recordatorios por WhatsApp?",
        a: "Alika arma la cola de recordatorios (48h y 3h antes del turno) y tu equipo los despacha con un clic desde /recordatorios. Nunca se manda un mensaje sin que alguien de tu clínica lo dispare.",
      },
      {
        q: "¿Tengo que conectar mi número de WhatsApp?",
        a: "No es obligatorio. Sin conectar nada, Alika arma el link de wa.me y tú lo abres manualmente. Si conectas tu número (Meta Cloud API), el envío se puede automatizar más — igual siempre queda a criterio de tu equipo cuándo despachar.",
      },
      {
        q: "¿Qué pasa si alguien que no es mi paciente me escribe por WhatsApp?",
        a: "Queda guardado como lead nuevo, sin perderse en el chat, para que tu equipo lo revise y lo convierta en paciente si corresponde.",
      },
    ],
  },
  {
    t: "Pacientes y datos",
    items: [
      {
        q: "¿Mis pacientes pueden agendar turno solos?",
        a: "Sí, por un link de portal que tu clínica les comparte — sin que necesiten crear una cuenta.",
      },
      {
        q: "¿Dónde se guardan mis datos?",
        a: "En Supabase, en la región de São Paulo, Brasil. El detalle completo está en la Política de Privacidad.",
      },
      {
        q: "¿Otras clínicas pueden ver mis datos?",
        a: "No. Cada clínica tiene sus datos aislados a nivel de base de datos (row-level security), no solo a nivel de interfaz.",
      },
      {
        q: "Si me quiero ir, ¿puedo llevarme mis datos?",
        a: "Sí. Antes de cerrar tu cuenta te damos la opción de exportar los datos de tu clínica.",
      },
    ],
  },
  {
    t: "Precio",
    items: [
      {
        q: "¿Cuánto cuesta Alika?",
        a: "US$49/mes, flat por clínica — sin cobro por profesional ni por sucursal. Las primeras clínicas quedan con este precio fundador de por vida. Trial de 14 días sin tarjeta.",
      },
    ],
  },
];

function Faq() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-wider text-mint-strong">Recursos</p>
        <h1 className="font-precise mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Preguntas frecuentes
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          ¿No encuentras lo que buscas? Escríbenos a{" "}
          <a
            href="mailto:maxnovaluciglobal@gmail.com"
            className="text-mint-strong underline underline-offset-2"
          >
            maxnovaluciglobal@gmail.com
          </a>
          .
        </p>

        <div className="mt-10 space-y-10">
          {grupos.map((g) => (
            <section key={g.t}>
              <h2 className="font-precise text-sm font-bold uppercase tracking-wider text-ink/60">
                {g.t}
              </h2>
              <Accordion type="single" collapsible className="mt-3">
                {g.items.map((item) => (
                  <AccordionItem key={item.q} value={item.q} className="border-hairline">
                    <AccordionTrigger className="text-left font-semibold hover:no-underline">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>

        <p className="mt-12 text-sm text-muted-foreground">
          ¿Quieres más detalle técnico? Mira la{" "}
          <Link to="/docs" className="text-mint-strong underline underline-offset-2">
            documentación
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
