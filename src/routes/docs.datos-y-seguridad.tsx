import { createFileRoute } from "@tanstack/react-router";
import { LegalH2, LegalP, LegalUl, LegalLi } from "@/components/legal-page";

export const Route = createFileRoute("/docs/datos-y-seguridad")({
  head: () => ({
    meta: [{ title: "Datos y seguridad · Documentación · Alika" }],
  }),
  component: DocsSeguridad,
});

function DocsSeguridad() {
  return (
    <article>
      <p className="text-xs font-semibold uppercase tracking-wider text-mint-strong">
        Documentación
      </p>
      <h1 className="font-precise mt-2 text-3xl font-bold tracking-tight">Datos y seguridad</h1>
      <LegalP>
        Esta página es el detalle técnico de cómo protegemos tus datos día a día. El marco legal
        completo está en la{" "}
        <a href="/privacidad" className="text-mint-strong underline underline-offset-2">
          Política de Privacidad
        </a>
        .
      </LegalP>

      <LegalH2>Aislamiento entre clínicas</LegalH2>
      <LegalP>
        Alika es multi-clínica sobre una misma base de datos, pero el aislamiento no depende solo de
        la interfaz: cada consulta a la base de datos pasa por políticas de row-level security (RLS)
        que verifican que el usuario pertenece a esa clínica antes de devolver una sola fila. Aunque
        hubiera un error en el código de la aplicación, la base de datos igual bloquea el acceso
        cruzado.
      </LegalP>

      <LegalH2>Permisos por rol</LegalH2>
      <LegalP>Dentro de una misma clínica, no todos los roles ven lo mismo:</LegalP>
      <LegalUl>
        <LegalLi>Notas clínicas: solo dueño, administrador, dentista y asistente.</LegalLi>
        <LegalLi>Pagos: los mismos roles, sin incluir asistente.</LegalLi>
        <LegalLi>
          Recepción puede ver agenda y datos de contacto, pero no historia clínica ni pagos.
        </LegalLi>
      </LegalUl>

      <LegalH2>Historial versionado, no sobrescritura</LegalH2>
      <LegalP>
        Las notas clínicas y las marcas del odontograma nunca se editan encima: cada cambio crea una
        fila nueva y cierra la anterior. Esto significa que siempre queda trazabilidad de quién
        anotó qué y cuándo, sin posibilidad de reescribir el historial clínico de un paciente.
      </LegalP>

      <LegalH2>Copia local para trabajar sin conexión</LegalH2>
      <LegalP>
        Para que un corte de internet no deje a la clínica sin poder ver nada, el navegador guarda
        una copia de lo indispensable para atender: agenda, listado y ficha básica de pacientes, y
        los catálogos de la clínica. Es una lista blanca explícita — lo que no está en ella no se
        guarda en el equipo. Quedan afuera a propósito las notas clínicas, el odontograma y el
        detalle de pagos: son los datos más sensibles y no hacen falta en el mostrador.
      </LegalP>
      <LegalP>
        Esa copia queda asociada al usuario que inició sesión. Si en un equipo compartido entra otra
        persona, la copia anterior se descarta en vez de mostrársela. Además se borra al cerrar
        sesión y caduca sola a los 7 días.
      </LegalP>

      <LegalH2>Dónde vive la infraestructura</LegalH2>
      <LegalP>
        Base de datos, autenticación y almacenamiento corren sobre Supabase, región sa-east-1 (São
        Paulo, Brasil). Toda la comunicación entre tu navegador y Alika viaja cifrada por HTTPS.
      </LegalP>

      <LegalH2>Portal de pacientes</LegalH2>
      <LegalP>
        Los links del portal son URLs firmadas con vencimiento (7-14 días por defecto) y la sesión
        que abren usa una cookie con el flag HttpOnly, no accesible desde JavaScript en el
        navegador. El portal en sí no expone historia clínica, odontograma ni pagos — solo agenda.
      </LegalP>

      <LegalH2>Algo no cuadra o encontraste un problema</LegalH2>
      <LegalP>
        Si detectas algo que te parece un problema de seguridad, escríbenos directamente a{" "}
        <a
          href="mailto:maxnovaluciglobal@gmail.com"
          className="text-mint-strong underline underline-offset-2"
        >
          maxnovaluciglobal@gmail.com
        </a>{" "}
        — lo tratamos como prioridad.
      </LegalP>
    </article>
  );
}
