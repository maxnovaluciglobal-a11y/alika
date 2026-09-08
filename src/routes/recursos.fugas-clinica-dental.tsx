// src/routes/recursos.fugas-clinica-dental.tsx
//
// Lead magnet público (Task 12 del plan de captación, Fase 3). A diferencia de
// la calculadora (Task 7), acá no hay ningún cálculo: es un checklist de
// lectura, 15 fugas de dinero comunes en una clínica dental. Se lee entera y
// gratis — nada se gatea. El PDF descargable (Task 13, todavía sin ejecutar)
// va a vivir en esta misma página; hasta entonces el formulario del pie se
// comporta exactamente igual que en la calculadora: guarda el contacto y
// muestra el mensaje genérico de éxito, sin prometer un PDF que hoy no existe.
//
// Regla no-negociable de esta tarea: cada fuga describe un problema real del
// dueño de la clínica SIN nombrar ninguna función de Alika. Tiene que ser útil
// por sí sola para alguien que nunca vaya a usar el producto.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LegalH2, LegalP, LegalNotice } from "@/components/legal-page";
import { canonicalHead, SITE_URL } from "@/lib/seo";
import { COUNTRIES } from "@/lib/onboarding-types";
import { LeadForm } from "@/components/marketing/lead-form";
import type { MetaLead, PaisCaptacion } from "@/lib/marketing/leads";
import { cn } from "@/lib/utils";

// Mismo shape que `ldJsonScript()` de src/lib/seo.ts (privado a propósito ahí,
// ver la nota de esa tarea) — duplicado local, igual que en la calculadora.
// OJO al gotcha documentado en seo.ts:18-24: `head().scripts` NO anida bajo
// `attrs`, así que el objeto va con `type`/`children` directo.
function ldJsonScript(data: Record<string, unknown>) {
  return { type: "application/ld+json", children: JSON.stringify(data) };
}

export const Route = createFileRoute("/recursos/fugas-clinica-dental")({
  head: () => {
    const canonical = canonicalHead("/recursos/fugas-clinica-dental");
    const titulo = "15 fugas de dinero de una clínica dental · Alika";
    const descripcion =
      "Checklist gratuito para auto-chequear tu clínica dental: ausencias, presupuestos sin seguimiento, stock, laboratorio, comisiones, cobranza y más. Se lee completo, sin registrarte.";
    const url = `${SITE_URL}/recursos/fugas-clinica-dental`;
    return {
      meta: [
        { title: titulo },
        { name: "description", content: descripcion },
        { property: "og:title", content: titulo },
        { property: "og:description", content: descripcion },
        { property: "og:type", content: "article" },
        { name: "robots", content: "index,follow" },
        ...canonical.meta,
      ],
      links: canonical.links,
      scripts: [
        ldJsonScript({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
            {
              "@type": "ListItem",
              position: 2,
              name: "15 fugas de dinero de una clínica dental",
              item: url,
            },
          ],
        }),
      ],
    };
  },
  component: FugasClinicaDental,
});

// ---------------------------------------------------------------------------
// Las 15 fugas. Contenido puro (sin React) — anclado en problemas operativos
// reales, verificable a ojo por cualquier dueño de clínica, no en estadísticas
// inventadas ni atribuidas a una fuente que no las publica (ver el mismo
// cuidado en calculadora-rentabilidad-dental.tsx).
// ---------------------------------------------------------------------------

type Fuga = { numero: number; titulo: string; descripcion: string; pregunta: string };

const FUGAS: Fuga[] = [
  {
    numero: 1,
    titulo: "El sillón vacío que nadie vuelve a llenar",
    descripcion:
      "Un turno que se cae a último momento casi nunca se recupera ese mismo día: el hueco queda vacío y esa hora de sillón — que tiene costo fijo la ocupes o no — se pierde para siempre, no se corre para mañana.",
    pregunta:
      "¿Sabés cuántos turnos se cayeron el mes pasado y cuántos de esos huecos se volvieron a ocupar?",
  },
  {
    numero: 2,
    titulo: "El presupuesto que el paciente aceptó y nadie agendó",
    descripcion:
      'Aceptar un presupuesto no es lo mismo que sacar el turno para hacerlo. Si nadie se ocupa de convertir ese "sí" en una fecha concreta, el ingreso queda flotando en un papel firmado.',
    pregunta:
      "¿Podés nombrar ahora mismo un presupuesto aceptado este mes que todavía no tiene fecha de tratamiento?",
  },
  {
    numero: 3,
    titulo: "El presupuesto que se manda y se olvida",
    descripcion:
      "Un paciente que recibió un presupuesto y no contestó en una semana casi nunca retoma la conversación solo — necesita que alguien de la clínica vuelva a escribirle.",
    pregunta:
      "¿Alguien de tu equipo tiene la tarea explícita de reescribirle a un presupuesto que lleva más de 7 días sin respuesta?",
  },
  {
    numero: 4,
    titulo: "La comisión de la tarjeta que se descuenta sola",
    descripcion:
      "Débito y crédito retienen un porcentaje de cada cobro antes de que ese dinero te llegue. Si tus precios se fijaron sin contar esa retención, la estás pagando vos, no el paciente.",
    pregunta:
      "¿El precio de tus tratamientos ya contempla la retención del medio de pago, o la descubrís recién cuando llega la liquidación?",
  },
  {
    numero: 5,
    titulo: "El convenio que se liquida a ojo",
    descripcion:
      "Cada aseguradora o convenio corporativo suele pagar un porcentaje distinto sobre el mismo procedimiento. Liquidar de memoria, sin dejar registrado qué porcentaje le tocaba a cada paciente, es la forma más fácil de cobrar de más o de menos sin darte cuenta.",
    pregunta:
      "Si tuvieras que liquidar hoy un convenio de hace dos meses, ¿tenés el dato de qué porcentaje correspondía a cada paciente, o hay que reconstruirlo?",
  },
  {
    numero: 6,
    titulo: "La orden de laboratorio que nadie puede rastrear",
    descripcion:
      "Sin una fecha de envío y un costo por orden registrados en algún lado, no hay forma de saber si un trabajo se está demorando más de lo normal ni cuánto te está costando de verdad ese procedimiento.",
    pregunta:
      "¿Podés decir hoy cuánto gastaste en laboratorio el mes pasado sin sumar facturas a mano?",
  },
  {
    numero: 7,
    titulo: "El insumo que se usa y no se descuenta",
    descripcion:
      "Cada procedimiento consume una cantidad conocida de insumos — guantes, anestesia, materiales de obturación. Si ese consumo no se descuenta al momento de usarlo, el stock que creés tener y el que hay realmente en la bodega empiezan a divergir desde el primer día.",
    pregunta:
      "¿El stock que muestra tu planilla o sistema hoy coincide con lo que hay físicamente en la bodega, o hace tiempo que dejaste de confiar en ese número?",
  },
  {
    numero: 8,
    titulo: "El conteo físico que nunca se hace",
    descripcion:
      "Sin un conteo periódico contra lo que dice el registro, un faltante — por vencimiento, rotura o porque nadie lo anotó — se descubre recién cuando falta el insumo en plena atención, no antes.",
    pregunta:
      "¿Cuándo fue la última vez que alguien contó físicamente el stock de la bodega y lo comparó contra el sistema?",
  },
  {
    numero: 9,
    titulo: "La comisión que se calcula en una planilla aparte",
    descripcion:
      "Cuando cada profesional cobra un porcentaje distinto según el procedimiento, calcularlo a mano a fin de mes no sólo consume horas: es el tipo de cálculo donde un error de tipeo se transforma directo en pagarle de más o de menos a alguien.",
    pregunta:
      "¿Cuánto tiempo le toma a alguien de tu equipo cerrar las comisiones del mes, y quién revisa ese número antes de pagarlo?",
  },
  {
    numero: 10,
    titulo: "La ficha en papel que se puede perder, mojar o quemar",
    descripcion:
      "Una historia clínica en papel vive en un único lugar físico: si se moja, se traspapela o el profesional se va y se la lleva, no hay copia. En la mayoría de los países de la región, además, guardarla por un plazo mínimo es una obligación legal, no una opción.",
    pregunta:
      "Si hoy se dañara el archivero de fichas, ¿podrías reconstruir la historia clínica de tus pacientes?",
  },
  {
    numero: 11,
    titulo: "El recordatorio que depende de que alguien se acuerde de mandarlo",
    descripcion:
      "Si confirmar la cita de mañana depende de que una persona se acuerde de escribirle a cada paciente uno por uno, un día ocupado sin más hace que ese recordatorio no salga — y suele ser justo ese día el que después sube el ausentismo.",
    pregunta:
      "¿Qué pasa con los recordatorios de mañana si la persona que normalmente los manda hoy no viene a trabajar?",
  },
  {
    numero: 12,
    titulo: "El paciente que no volvió y nadie notó que faltaba",
    descripcion:
      "Un paciente que terminó su tratamiento y no vuelve al control de rutina a los 6 o 12 meses no manda ninguna señal: no cancela nada, simplemente deja de aparecer. Sin una lista de a quién le toca volver, se pierde de vista.",
    pregunta:
      "¿Tenés una lista de pacientes a los que ya les toca su control, y hace cuánto no la revisás?",
  },
  {
    numero: 13,
    titulo: "El saldo pendiente que nadie vuelve a pedir",
    descripcion:
      "Un plan de pago en cuotas que se atrasa una vez rara vez se pone al día solo. Sin alguien que revise quién debe y desde cuándo, la plata pendiente de cobro se acumula en silencio, cita tras cita.",
    pregunta:
      "¿Sabés hoy, sin ponerte a buscar, cuánto te deben en total tus pacientes y quiénes son los más atrasados?",
  },
  {
    numero: 14,
    titulo: "El tratamiento que parece rentable y no lo es",
    descripcion:
      "Facturar mucho no es lo mismo que ganar mucho: un tratamiento de ticket alto que consume mucho tiempo de sillón, insumos caros y laboratorio puede dejarte menos margen real que uno más chico y simple. Sin comparar ingreso contra costo por profesional o por tipo de procedimiento, esa diferencia queda invisible.",
    pregunta:
      "¿Podés decir hoy qué profesional o qué tipo de tratamiento te deja más margen real, o sólo sabés cuál factura más?",
  },
  {
    numero: 15,
    titulo: "El hueco en la agenda que se descubre demasiado tarde",
    descripcion:
      "Un espacio libre entre dos citas de la misma tarde, si nadie lo mira con anticipación, casi nunca se llena — se detecta recién cuando ya es tarde para ofrecérselo a otro paciente que estaba esperando turno.",
    pregunta:
      "¿Alguien revisa la agenda de mañana con un día de anticipación buscando huecos que todavía se puedan llenar, o se descubren en el momento?",
  },
];

// ---------------------------------------------------------------------------
// Piezas de UI page-local
// ---------------------------------------------------------------------------

function CasillaDecorativa() {
  // A propósito NO es un <input type="checkbox">: es una lista de
  // auto-chequeo para que el lector la marque con lápiz o mentalmente, no un
  // control que el formulario de esta página necesite leer. Un checkbox real
  // acá implicaría estado, sin ningún consumidor de ese estado.
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 inline-block size-4 shrink-0 rounded-[4px] border-2 border-hairline"
    />
  );
}

function FilaFuga({ fuga }: { fuga: Fuga }) {
  return (
    <li className="border-b border-hairline py-7 first:pt-0 last:border-b-0">
      <div className="flex items-start gap-4">
        <span className="font-precise flex size-8 shrink-0 items-center justify-center rounded-full bg-mint-soft text-sm font-bold text-mint-strong">
          {fuga.numero}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-precise text-lg font-bold text-ink">{fuga.titulo}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/80">{fuga.descripcion}</p>
          <div className="mt-4 flex items-start gap-2.5">
            <CasillaDecorativa />
            <span className="text-sm text-muted-foreground">Se aplica a mi clínica</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink/70">
            <span className="font-semibold text-mint-strong">Detectala:</span> {fuga.pregunta}
          </p>
        </div>
      </div>
    </li>
  );
}

function SelectorPais({
  value,
  onChange,
}: {
  value: PaisCaptacion;
  onChange: (v: PaisCaptacion) => void;
}) {
  return (
    <div role="group" aria-label="País de tu clínica" className="mt-3 flex flex-wrap gap-2">
      {COUNTRIES.map((c) => {
        const activo = c.code === value;
        return (
          <button
            key={c.code}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(c.code)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              activo
                ? "border-ink bg-ink text-ink-foreground"
                : "border-hairline bg-card text-muted-foreground hover:border-ink/40 hover:text-ink",
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

function FugasClinicaDental() {
  // Sin cálculo previo (a diferencia de la calculadora), así que no hay un
  // país "correcto" derivado de ningún dato cargado — es sólo el país que el
  // visitante dice que tiene su clínica, para que el lead quede bien
  // etiquetado. Default CL por ser el mercado de origen.
  const [paisCode, setPaisCode] = useState<PaisCaptacion>("CL");

  // Los tres buckets van "na": no hay ningún cálculo de margen, ausentismo ni
  // conversión en esta página — eso es exclusivo de la calculadora (Task 7).
  // retencion_declarada es false por el mismo motivo: no hay nada que el
  // visitante haya declarado.
  const metaLead: MetaLead = {
    margen_bucket: "na",
    ausencias_bucket: "na",
    conversion_bucket: "na",
    retencion_declarada: false,
    pais: paisCode,
  };

  return (
    <LegalPage
      label="Recurso gratuito"
      title="15 fugas de dinero de una clínica dental"
      updated="Versión 1 · 8 de septiembre de 2026 · Alika"
    >
      <LegalNotice>
        Esta página se lee completa y gratis, sin registrarte en ningún lado. Es un checklist para
        que audites tu propia clínica en diez minutos — nada de esto depende de qué sistema uses, ni
        siquiera de que uses alguno.
      </LegalNotice>

      <LegalP>
        Cada fuga es un problema real de gestión, no una falla clínica: ninguna tiene que ver con la
        calidad de tu trabajo como odontólogo o dueño. Todas tienen algo en común — pasan en
        silencio, sin que nadie las note en el momento, y sólo se ven cuando alguien se sienta a
        sumar el mes.
      </LegalP>
      <LegalP>
        Recorré la lista, marcá las que te suenan y anotá cuántas te aplican. Al pie te contamos qué
        hacer con eso.
      </LegalP>

      <LegalH2>Las 15 fugas</LegalH2>
      <ol className="mt-4">
        {FUGAS.map((fuga) => (
          <FilaFuga key={fuga.numero} fuga={fuga} />
        ))}
      </ol>

      <LegalH2>¿Marcaste varias?</LegalH2>
      <LegalP>
        Es lo normal — casi ninguna clínica llega a diez minutos de auditoría sin encontrarse en
        varias de estas quince. Dejanos tu contacto y nos ponemos en contacto para ayudarte a mirar,
        de todas las que marcaste, cuál conviene resolver primero.
      </LegalP>

      <div className="mt-8 rounded-3xl border border-hairline bg-card p-6 sm:p-8">
        <p className="font-precise text-xs font-bold uppercase tracking-wider text-ink/60">
          País de tu clínica
        </p>
        <SelectorPais value={paisCode} onChange={setPaisCode} />
        <div className="mt-6">
          <LeadForm
            source="checklist"
            pais={paisCode}
            meta={metaLead}
            tituloExito="Guardamos tu contacto."
            slugRecurso="fugas-clinica-dental"
          />
        </div>
      </div>
    </LegalPage>
  );
}
