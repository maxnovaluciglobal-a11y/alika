import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalH2, LegalP } from "@/components/legal-page";

export const Route = createFileRoute("/nosotros")({
  head: () => ({
    meta: [
      { title: "Quiénes somos · Alika" },
      {
        name: "description",
        content:
          "Alika es un proyecto chico hecho por una sola persona para clínicas dentales de Latinoamérica. Por qué existe y cómo se construye.",
      },
    ],
  }),
  component: Nosotros,
});

function Nosotros() {
  return (
    <LegalPage label="Empresa" title="Quiénes somos">
      <div className="flex items-start gap-4 rounded-xl border border-hairline bg-card p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink font-precise text-lg font-bold text-ink-foreground">
          W
        </span>
        <div>
          <p className="text-base leading-relaxed text-ink">
            "Soy Walter. Hice Alika porque vi clínicas ahogadas en planillas y recordatorios a mano.
            Está pensado para cómo se trabaja en LatAm. Si lo pruebas y algo te traba, escríbeme —
            te respondo yo."
          </p>
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            Walter · fundador de Alika
          </p>
        </div>
      </div>

      <LegalH2>Por qué Alika</LegalH2>
      <LegalP>
        Alika nació de ver de cerca cómo se administra una clínica dental chica o mediana en
        Latinoamérica: agenda en WhatsApp o en papel, fichas clínicas en Excel o en carpetas,
        recordatorios de turno que dependen de que alguien se acuerde de mandarlos a mano. El
        software que existe para esto suele estar hecho para otro mercado, en otro idioma, con otro
        precio.
      </LegalP>
      <LegalP>
        La apuesta de Alika es simple: agenda, ficha clínica, odontograma, presupuestos y cobranza
        en un solo lugar, con WhatsApp integrado de forma nativa — no como un agregado. Menos
        planillas, menos pacientes que se pierden entre un sistema y otro.
      </LegalP>

      <LegalH2>Cómo se hace</LegalH2>
      <LegalP>
        Hoy Alika es un proyecto de una sola persona, no una empresa con equipo grande detrás. Eso
        significa que las decisiones se toman rápido y el producto cambia seguido, pero también que
        la capacidad de soporte y desarrollo tiene el límite de una persona. Preferimos ser honestos
        con esto antes que prometer una estructura que todavía no existe.
      </LegalP>
      <LegalP>
        Alika está en etapa de piloto: se está terminando de construir y probando con clínicas
        seleccionadas antes de abrirse al público en general. Si tu clínica quiere ser parte de esa
        etapa temprana, escríbenos.
      </LegalP>

      <LegalH2>La empresa detrás</LegalH2>
      <LegalP>
        Alika es operado por MAXNOVA &amp; LUCI Global LLC, una LLC constituida en Estados Unidos.
        Más detalles de cómo tratamos los datos de tu clínica y tus pacientes están en la{" "}
        <a href="/privacidad" className="text-mint-strong underline underline-offset-2">
          Política de Privacidad
        </a>
        .
      </LegalP>

      <LegalH2>Contacto</LegalH2>
      <LegalP>
        Para consultas, piloto o soporte:{" "}
        <a
          href="mailto:maxnovaluciglobal@gmail.com"
          className="text-mint-strong underline underline-offset-2"
        >
          maxnovaluciglobal@gmail.com
        </a>
        .
      </LegalP>
    </LegalPage>
  );
}
