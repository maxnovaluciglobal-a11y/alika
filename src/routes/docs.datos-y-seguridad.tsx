import { createFileRoute } from "@tanstack/react-router";
import { LegalH2, LegalP, LegalUl, LegalLi } from "@/components/legal-page";
import { canonicalHead } from "@/lib/seo";

export const Route = createFileRoute("/docs/datos-y-seguridad")({
  head: () => {
    const canonical = canonicalHead("/docs/datos-y-seguridad");
    return {
      meta: [{ title: "Datos y seguridad · Documentación · Alika" }, ...canonical.meta],
      links: canonical.links,
    };
  },
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

      <LegalH2>Trabajar durante un corte de internet</LegalH2>
      <LegalP>
        Cobrar, agendar, editar una nota clínica y marcar el odontograma funcionan sin conexión: la
        operación queda guardada en el equipo y se sincroniza sola al volver internet. Cada una
        lleva un identificador generado en el momento de la captura, así que si la sincronización se
        reintenta el servidor reconoce que ya la había guardado y no la duplica. Los cobros
        conservan la hora en que se hicieron, no la hora en que se subieron — de otro modo el cierre
        de caja del día no cuadraría.
      </LegalP>
      <LegalP>
        Si el servidor rechaza una operación por una razón real (permisos, validación), no se
        reintenta para siempre ni desaparece: queda marcada para que alguien la revise. Lo que no
        funciona sin conexión —mandar WhatsApp, crear presupuestos con numeración correlativa— se
        avisa en el momento en vez de fallar en silencio.
      </LegalP>
      <LegalP>
        Notas clínicas y odontograma tienen un caso extra: si dos personas cambian lo mismo casi al
        mismo tiempo —una offline, otra desde otro equipo— el sistema no deja que la segunda pise a
        la primera en silencio. La captura offline se guarda igual (nunca se pierde) pero no se
        aplica automáticamente: queda en una bandeja de conflictos con ambas versiones a la vista,
        para que el profesional elija cuál vale.
      </LegalP>

      <LegalH2>Copia local para consultar (distinta de la cola de arriba)</LegalH2>
      <LegalP>
        Para que un corte de internet no deje a la clínica sin poder ver nada, el navegador guarda
        una copia de lo indispensable para atender: agenda, listado y ficha básica de pacientes, y
        los catálogos de la clínica. Es una lista blanca explícita — lo que no está en ella no se
        guarda en esta copia. Quedan afuera a propósito las notas clínicas, el odontograma y el
        detalle de pagos: son los datos más sensibles y no hacen falta para consultar en el
        mostrador (si se cargan sin conexión, sí pasan brevemente por la cola de sincronización de
        arriba hasta subir — ver sección anterior).
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
