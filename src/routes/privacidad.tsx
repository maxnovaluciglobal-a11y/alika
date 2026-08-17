import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalH2, LegalP, LegalUl, LegalLi, LegalNotice } from "@/components/legal-page";

export const Route = createFileRoute("/privacidad")({
  head: () => ({
    meta: [
      { title: "Política de privacidad · Alika" },
      {
        name: "description",
        content:
          "Cómo Alika trata los datos de tu clínica y de tus pacientes: qué guardamos, dónde y con quién lo compartimos.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: Privacidad,
});

function Privacidad() {
  return (
    <LegalPage
      label="Legal"
      title="Política de privacidad"
      updated="Última actualización: agosto 2026 · MAXNOVA & LUCI Global LLC"
    >
      <LegalNotice>
        Tu clínica es la responsable de los datos de sus pacientes; Alika los procesa como encargado
        del tratamiento, para que la aplicación funcione. Si eres paciente de una clínica que usa
        Alika y quieres ejercer un derecho sobre tus datos (acceso, corrección, borrado), el camino
        es contactar directamente a tu clínica — nosotros ejecutamos el pedido técnico que tu
        clínica nos indique.
      </LegalNotice>

      <LegalH2>1. Quién es responsable</LegalH2>
      <LegalP>
        Alika lo opera MAXNOVA &amp; LUCI Global LLC, una LLC constituida en Estados Unidos. Para
        cualquier consulta de privacidad, escríbenos a{" "}
        <a
          href="mailto:maxnovaluciglobal@gmail.com"
          className="text-mint-strong underline underline-offset-2"
        >
          maxnovaluciglobal@gmail.com
        </a>
        .
      </LegalP>

      <LegalH2>2. Qué datos recopilamos</LegalH2>
      <LegalP>Según cómo uses Alika, procesamos:</LegalP>
      <LegalUl>
        <LegalLi>
          <strong>Datos de tu cuenta de staff</strong>: nombre, email, rol dentro de la clínica.
        </LegalLi>
        <LegalLi>
          <strong>Datos de pacientes</strong> que tu clínica carga: identidad, contacto, fecha de
          nacimiento, historia clínica y notas, odontograma, presupuestos, plan de tratamiento y
          pagos.
        </LegalLi>
        <LegalLi>
          <strong>Datos del portal de auto-agendamiento</strong>: cuando un paciente pide un turno
          por el link que le comparte la clínica.
        </LegalLi>
        <LegalLi>
          <strong>Mensajes de WhatsApp</strong>: si tu clínica conecta su número, los mensajes
          enviados y recibidos por ese canal (incluyendo los de personas que escriben sin ser
          pacientes todavía, para poder darles seguimiento como contacto nuevo).
        </LegalLi>
      </LegalUl>

      <LegalH2>3. Dónde se almacenan</LegalH2>
      <LegalP>
        Los datos viven en Supabase, en la región sa-east-1 (São Paulo, Brasil). El acceso a los
        datos de cada clínica está aislado a nivel de base de datos (row-level security): el
        personal de una clínica no puede ver datos de otra clínica, ni siquiera con un error de
        código de por medio.
      </LegalP>

      <LegalH2>4. Con quién compartimos datos</LegalH2>
      <LegalP>
        No vendemos datos a nadie. Usamos estos proveedores para que Alika funcione (subencargados
        del tratamiento):
      </LegalP>
      <LegalUl>
        <LegalLi>
          <strong>Supabase</strong> — base de datos, autenticación y almacenamiento de archivos.
        </LegalLi>
        <LegalLi>
          <strong>Meta (WhatsApp Cloud API)</strong> — solo si tu clínica conecta su número de
          WhatsApp; procesa los mensajes que se envían y reciben por ese canal.
        </LegalLi>
        <LegalLi>
          <strong>Proveedor de IA</strong> (Lovable AI Gateway, con Google Gemini u OpenAI como
          respaldo) — solo cuando un profesional pide generar el resumen de una nota clínica
          puntual; no se usa para ningún otro procesamiento automático de datos de pacientes.
        </LegalLi>
        <LegalLi>
          <strong>Stripe</strong> — hoy Alika no cobra suscripciones, así que Stripe todavía no
          procesa pagos de clínicas. Cuando la facturación esté activa, actualizamos esta sección.
        </LegalLi>
      </LegalUl>

      <LegalH2>5. Seguridad</LegalH2>
      <LegalP>
        Toda la comunicación viaja cifrada (HTTPS). El acceso a fichas clínicas está restringido por
        rol: recepción, por ejemplo, no puede ver notas clínicas. Los registros clínicos y del
        odontograma quedan versionados — nunca se sobrescriben, así que siempre hay un historial de
        quién cambió qué.
      </LegalP>

      <LegalH2>6. Retención y eliminación</LegalH2>
      <LegalP>
        Guardamos los datos mientras la cuenta de la clínica esté activa. Si una clínica cierra su
        cuenta, le damos la opción de exportar sus datos antes de que se eliminen de nuestros
        sistemas.
      </LegalP>

      <LegalH2>7. Cookies</LegalH2>
      <LegalP>
        Alika usa únicamente cookies funcionales, necesarias para que la aplicación funcione: una
        para recordar el estado de la barra lateral y otra para la sesión del portal de
        auto-agendamiento del paciente. Hoy no usamos cookies de analítica ni de publicidad.
      </LegalP>

      <LegalH2>8. Tus derechos</LegalH2>
      <LegalP>
        Si eres parte del staff de una clínica, puedes pedirle a tu clínica que corrija o elimine tu
        cuenta de usuario. Si eres paciente, tu clínica es quien administra tus datos — pídele a
        ella el acceso, corrección o eliminación; nosotros ejecutamos el pedido a nivel técnico
        cuando la clínica nos lo solicita.
      </LegalP>

      <LegalH2>9. Cambios a esta política</LegalH2>
      <LegalP>
        Si hacemos un cambio importante en cómo tratamos los datos, lo vamos a reflejar acá con la
        fecha actualizada y, si corresponde, avisamos por email a las clínicas.
      </LegalP>

      <LegalH2>10. Contacto</LegalH2>
      <LegalP>
        Para consultas sobre privacidad:{" "}
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
