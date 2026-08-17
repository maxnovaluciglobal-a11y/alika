import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalH2, LegalP, LegalUl, LegalLi, LegalNotice } from "@/components/legal-page";

export const Route = createFileRoute("/terminos")({
  head: () => ({
    meta: [
      { title: "Términos de servicio · Alika" },
      {
        name: "description",
        content: "Términos de servicio de Alika, software de gestión para clínicas dentales.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: Terminos,
});

function Terminos() {
  return (
    <LegalPage
      label="Legal"
      title="Términos de servicio"
      updated="Última actualización: agosto 2026 · MAXNOVA & LUCI Global LLC"
    >
      <LegalNotice>
        Alika está en etapa de piloto: se ofrece por invitación a clínicas seleccionadas, sin un
        plan público con precio todavía definido. Estos términos van a evolucionar cuando el
        producto salga de piloto — te vamos a avisar antes de cualquier cambio importante.
      </LegalNotice>

      <LegalH2>1. Qué es Alika</LegalH2>
      <LegalP>
        Alika es un software como servicio (SaaS) para la gestión de clínicas dentales: agenda,
        fichas clínicas, odontograma, presupuestos, cobranza y mensajería por WhatsApp. Lo opera
        MAXNOVA &amp; LUCI Global LLC ("Alika", "nosotros"). Al crear una cuenta o usar la
        aplicación aceptás estos términos.
      </LegalP>

      <LegalH2>2. Tu cuenta</LegalH2>
      <LegalP>
        Sos responsable de mantener la confidencialidad de tus credenciales y de la actividad que
        ocurre bajo tu cuenta. Cada clínica administra sus propios usuarios y roles (dueño,
        administrador, dentista, asistente, recepción); es responsabilidad de la clínica asignar el
        rol correcto a cada persona, especialmente para el acceso a fichas clínicas.
      </LegalP>

      <LegalH2>3. Datos de tus pacientes</LegalH2>
      <LegalP>
        Los datos que cargás sobre tus pacientes (identidad, contacto, historia clínica,
        odontograma, presupuestos, pagos) son tuyos. Tu clínica es la responsable/titular de esos
        datos frente a tus pacientes; Alika actúa como encargado del tratamiento, es decir,
        procesamos esos datos para que la aplicación funcione, pero no los usamos para otro fin ni
        se los vendemos a terceros. El detalle de cómo los tratamos está en la{" "}
        <a href="/privacidad" className="text-mint-strong underline underline-offset-2">
          Política de Privacidad
        </a>
        .
      </LegalP>
      <LegalP>
        Sos responsable de contar con la base legal correspondiente (consentimiento del paciente, u
        otra que aplique en tu jurisdicción) para cargar y procesar los datos de tus pacientes en
        Alika.
      </LegalP>

      <LegalH2>4. Uso aceptable</LegalH2>
      <LegalP>No podés usar Alika para:</LegalP>
      <LegalUl>
        <LegalLi>Cargar datos de personas que no son pacientes reales de tu clínica.</LegalLi>
        <LegalLi>
          Enviar mensajes por WhatsApp a quien no dio su número a tu clínica o no aceptó recibir
          comunicaciones (opt-in).
        </LegalLi>
        <LegalLi>Intentar acceder a datos de otra clínica distinta de la tuya.</LegalLi>
        <LegalLi>Usar la aplicación para actividades ilegales en tu jurisdicción.</LegalLi>
      </LegalUl>

      <LegalH2>5. WhatsApp y mensajería</LegalH2>
      <LegalP>
        Si conectás el número de WhatsApp de tu clínica, los mensajes salientes (recordatorios,
        avisos de lista de espera, seguimiento de presupuestos, etc.) se despachan siempre desde tu
        clínica, con revisión del personal antes de cada envío — Alika no manda mensajes de forma
        automática sin que alguien de tu equipo lo dispare. El cumplimiento de las políticas de
        Meta/WhatsApp Business sobre plantillas y ventanas de mensajería es responsabilidad
        compartida entre tu clínica y Alika como proveedor técnico.
      </LegalP>

      <LegalH2>6. Propiedad intelectual</LegalH2>
      <LegalP>
        El software de Alika, su diseño y su marca son propiedad de MAXNOVA &amp; LUCI Global LLC.
        Te damos una licencia para usarlo mientras tengas una cuenta activa; no se te transfiere
        ninguna propiedad sobre el software. Los datos que cargás siguen siendo tuyos como se
        describe en la sección 3.
      </LegalP>

      <LegalH2>7. Disponibilidad del servicio</LegalH2>
      <LegalP>
        Durante la etapa de piloto no ofrecemos un nivel de servicio (SLA) formal. Hacemos el mejor
        esfuerzo para mantener Alika disponible y avisamos con anticipación cuando sabemos que va a
        haber una interrupción planificada. Podemos modificar o agregar funcionalidades sin previo
        aviso mientras el producto está en desarrollo activo.
      </LegalP>

      <LegalH2>8. Terminación</LegalH2>
      <LegalP>
        Podés dejar de usar Alika y pedir el cierre de tu cuenta cuando quieras. Al cerrar tu cuenta
        te damos la posibilidad de exportar los datos de tu clínica antes de que se eliminen de
        nuestros sistemas. Podemos suspender una cuenta que incumpla la sección 4 (uso aceptable),
        avisando el motivo salvo que la ley nos impida hacerlo.
      </LegalP>

      <LegalH2>9. Límite de responsabilidad</LegalH2>
      <LegalP>
        Alika se ofrece "tal cual", especialmente durante la etapa de piloto. En la medida que lo
        permita la ley aplicable, no somos responsables por daños indirectos derivados del uso de la
        aplicación. Nada en estos términos limita responsabilidad por dolo o negligencia grave donde
        la ley no lo permita.
      </LegalP>

      <LegalH2>10. Ley aplicable</LegalH2>
      <LegalP>
        Estos términos se rigen por las leyes aplicables a MAXNOVA &amp; LUCI Global LLC como LLC
        constituida en Estados Unidos. Esto no reemplaza las obligaciones locales que tu clínica
        tenga respecto a la protección de datos de salud de tus pacientes según la legislación de tu
        país — te recomendamos consultarlo con tu asesor legal local.
      </LegalP>

      <LegalH2>11. Cambios a estos términos</LegalH2>
      <LegalP>
        Si hacemos un cambio importante en estos términos te vamos a avisar por email o dentro de la
        aplicación antes de que entre en vigencia.
      </LegalP>

      <LegalH2>12. Contacto</LegalH2>
      <LegalP>
        Para consultas sobre estos términos:{" "}
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
