import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalH2, LegalP, LegalUl, LegalLi, LegalNotice } from "@/components/legal-page";
import { canonicalHead } from "@/lib/seo";

export const Route = createFileRoute("/privacidad")({
  head: () => {
    const canonical = canonicalHead("/privacidad");
    return {
      meta: [
        { title: "Política de privacidad · Alika" },
        {
          name: "description",
          content:
            "Cómo Alika trata los datos de tu clínica, de tus pacientes y de quien usa nuestras herramientas gratuitas: qué guardamos, para qué, dónde y por cuánto tiempo.",
        },
        { name: "robots", content: "index,follow" },
        ...canonical.meta,
      ],
      links: canonical.links,
    };
  },
  component: Privacidad,
});

function Privacidad() {
  return (
    <LegalPage
      label="Legal"
      title="Política de privacidad"
      updated="Versión 2 · 8 de septiembre de 2026 · MAXNOVA & LUCI Global LLC"
    >
      <LegalNotice>
        Tu clínica es la responsable de los datos de sus pacientes; Alika los procesa como encargado
        del tratamiento, para que la aplicación funcione. Si eres paciente de una clínica que usa
        Alika y quieres ejercer un derecho sobre tus datos (acceso, corrección, borrado), el camino
        es contactar directamente a tu clínica — nosotros ejecutamos el pedido técnico que tu
        clínica nos indique.
        <br />
        <br />
        Si llegaste acá desde la calculadora o desde un material gratuito y todavía no eres paciente
        ni tienes cuenta, lo tuyo es distinto y está separado a propósito en la{" "}
        <strong>sección 3</strong>: ahí no somos encargados de nadie, el responsable de esos datos
        somos nosotros.
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
        . Ese correo lo lee el equipo que opera Alika, no un buzón automático.
      </LegalP>
      <LegalP>
        Hoy no tenemos un representante legal designado en Chile. Si la ley chilena nos exige
        designar uno, lo designamos y lo publicamos en esta misma página, con nombre y forma de
        contacto — no en un anexo aparte.
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
      <LegalP>
        <strong>Con qué base tratamos todo esto.</strong> Con los datos de pacientes, Alika actúa
        como encargado: la base de legitimidad la fija tu clínica, que es la responsable — en
        general, la atención de salud que te está dando y la relación que tienes con ella. Con las
        cuentas de staff, la base es el contrato de servicio entre Alika y la clínica: sin cuenta no
        hay aplicación que usar. Los datos de quien todavía no es paciente ni cliente van por otro
        camino, con sus propias finalidades y sus propias bases, y por eso tienen su sección aparte
        acá abajo.
      </LegalP>

      <LegalH2>3. Si usaste la calculadora o pediste un material nuestro</LegalH2>
      <LegalP>
        Este es el caso distinto a todo lo anterior: alguien que entra al sitio, usa una herramienta
        gratuita o pide un material, y todavía no es paciente de nadie ni tiene cuenta en Alika. Ahí
        no hay clínica de por medio — el responsable de esos datos somos nosotros, directamente.
      </LegalP>
      <LegalP>
        <strong>Qué te pedimos.</strong> Un email o un WhatsApp (al menos uno de los dos, porque sin
        eso no hay a dónde mandarte lo que pediste) y el país de tu clínica. Tu nombre y el nombre
        de la clínica son opcionales: si los dejas en blanco, el formulario se envía igual. De la
        conexión guardamos un hash de tu dirección IP — no la IP — y el navegador con el que
        enviaste.
      </LegalP>
      <LegalP>
        <strong>Las cifras que escribes en la calculadora no llegan a nuestro servidor.</strong> El
        cálculo ocurre en tu navegador. Lo único que viaja con el formulario es una clasificación
        por rangos del resultado (por ejemplo <em>margen: bajo</em>, <em>ausencias: alto</em>), y el
        servidor descarta cualquier valor numérico que llegue en ese campo. Cuánto factura tu
        clínica no tiene por qué salir de tu pantalla si todavía no eres cliente.
      </LegalP>
      <LegalP>
        <strong>Eso es elaboración de perfiles, y preferimos decirlo con todas las letras.</strong>{" "}
        Guardar <em>margen: bajo</em> para decidir a quién contactar primero y con qué mensaje es
        elaboración de perfiles en los términos de la Ley 21.719, no un detalle técnico. Lo que no
        hay es una decisión automatizada: nadie queda aprobado, rechazado ni puntuado por un
        algoritmo — una persona lee el rango y decide si te escribe. Puedes oponerte a esa
        clasificación escribiéndonos, y no hace falta que expliques por qué.
      </LegalP>
      <LegalP>
        <strong>Para qué usamos esos datos, y con qué base cada cosa.</strong> Son finalidades
        distintas y no vienen en el mismo paquete:
      </LegalP>
      <LegalUl>
        <LegalLi>
          <strong>Enviarte el material que pediste</strong> — base: tu consentimiento, el de la
          casilla que tuviste que marcar tú (no viene marcada de fábrica).
        </LegalLi>
        <LegalLi>
          <strong>Escribirte por email para contarte qué es Alika</strong> — base: ese mismo
          consentimiento, cuyo texto exacto guardamos junto con la fecha en que lo diste.
        </LegalLi>
        <LegalLi>
          <strong>Escribirte por WhatsApp con novedades comerciales</strong> — base: un
          consentimiento aparte, con su propia casilla. Dejar el número para recibir el material no
          alcanza: si no marcaste esa segunda casilla, por WhatsApp no te escribimos.
        </LegalLi>
        <LegalLi>
          <strong>Priorizar a quién contactamos</strong>, con los rangos del párrafo anterior —
          base: nuestro interés legítimo en no mandarle lo mismo a todo el mundo. Es la finalidad a
          la que te puedes oponer sin que se caiga el resto.
        </LegalLi>
        <LegalLi>
          <strong>Frenar bots y envíos repetidos</strong>, con el hash de la IP — base: nuestro
          interés legítimo en que el formulario no se llene de basura. Por eso guardamos el hash y
          no la dirección: para contar envíos alcanza.
        </LegalLi>
        <LegalLi>
          <strong>Poder probar que nos diste el consentimiento</strong>, guardando la fecha y el
          texto literal que aceptaste — base: la propia ley, que pone esa carga de la prueba en
          nosotros y no en ti. Si el texto del formulario cambia después, seguimos sabiendo cuál
          aceptaste tú.
        </LegalLi>
      </LegalUl>
      <LegalP>
        <strong>El trato es explícito.</strong> La calculadora y los materiales son gratis, y lo
        único que pedimos a cambio son tus datos de contacto. Lo decimos así de directo a propósito:
        la ley chilena admite ese intercambio cuando está declarado y a la vista — el consentimiento
        como única contraprestación —, no cuando viene escondido entre la letra chica.
      </LegalP>
      <LegalP>
        <strong>Cuánto tiempo los guardamos.</strong> Hasta 24 meses desde tu última interacción con
        nosotros (el último formulario que enviaste o el último mensaje que nos escribiste).
        Cumplido ese plazo, si no llegaste a ser cliente, borramos el contacto completo: email,
        teléfono, nombre y los rangos. Si pides la baja antes, borramos antes.
      </LegalP>
      <LegalP>
        <strong>Cómo te das de baja.</strong> Cuando quieras, gratis, sin explicar por qué y sin que
        intentemos convencerte de lo contrario. Hoy el camino es escribirnos a{" "}
        <a
          href="mailto:maxnovaluciglobal@gmail.com"
          className="text-mint-strong underline underline-offset-2"
        >
          maxnovaluciglobal@gmail.com
        </a>{" "}
        diciendo que quieres la baja: dejamos de escribirte apenas lo leemos y borramos tu email y
        tu teléfono dentro de los 30 días.{" "}
        <strong>Todavía no existe un enlace de un click para darte de baja solo.</strong> Cuando
        exista, va a estar en cada mensaje que te mandemos y lo vas a leer acá. Preferimos decirlo
        así antes que prometer un botón que no está.
      </LegalP>
      <LegalP>
        <strong>Hoy no hay envío automático de correos.</strong> Alika todavía no tiene activado el
        envío de email, así que si dejas tu dirección queda guardada para que podamos escribirte a
        mano, no para que un sistema te empiece a mandar cosas por su cuenta. Cuando lo activemos,
        actualizamos esta sección.
      </LegalP>

      <LegalH2>4. Dónde se almacenan</LegalH2>
      <LegalP>
        Los datos viven en Supabase, en la región sa-east-1 (São Paulo, Brasil). El acceso a los
        datos de cada clínica está aislado a nivel de base de datos (row-level security): el
        personal de una clínica no puede ver datos de otra clínica, ni siquiera con un error de
        código de por medio.
      </LegalP>
      <LegalP>
        <strong>Copia local para consultar.</strong> Para que la clínica pueda seguir consultando
        información durante un corte de internet, el navegador del equipo guarda una copia de parte
        de los datos. Esa copia se limita a lo necesario para atender: agenda, listado y ficha
        básica de pacientes, y catálogos de la clínica (sucursales, profesionales, procedimientos).{" "}
        <strong>
          Las notas clínicas, el odontograma y el detalle de pagos no se guardan en esta copia
        </strong>{" "}
        — para consultarlos hace falta conexión. Esta copia queda asociada al usuario que inició
        sesión, se borra al cerrar sesión y caduca a los 7 días.
      </LegalP>
      <LegalP>
        <strong>Cola temporal para lo que se registra sin conexión.</strong> Es un espacio aparte
        del anterior: cuando el equipo cobra, agenda, edita una nota clínica o marca el odontograma
        sin internet, esa captura queda guardada en el navegador hasta que pueda subirse — sí,
        incluyendo el contenido clínico en ese caso puntual. No es una copia adicional de toda la
        historia del paciente: solo lo que efectivamente se registró estando offline, y desaparece
        del equipo en cuanto sincroniza. Si el servidor detecta que otra persona cambió lo mismo
        mientras tanto, ninguna de las dos versiones se pierde: ambas quedan visibles para que el
        profesional decida cuál vale.
      </LegalP>

      <LegalH2>5. Transferencias fuera de Chile</LegalH2>
      <LegalP>
        Hay dos, y conviene decirlas sin rodeos. La primera: los datos están alojados en Brasil (São
        Paulo), no en Chile. La segunda: quien opera Alika es una empresa constituida en Estados
        Unidos, así que el equipo que administra la base accede desde fuera de Chile. Las dos valen
        tanto para los datos de la clínica y sus pacientes como para los de captación de la sección
        3.
      </LegalP>
      <LegalP>
        <strong>
          No te vamos a decir que existe una declaración de nivel adecuado a favor de Brasil o de
          Estados Unidos, porque no nos consta.
        </strong>{" "}
        Lo que sí podemos afirmar es lo que hacemos: la comunicación viaja cifrada, el aislamiento
        entre clínicas está en la base de datos y no en la pantalla (sección 7), y el acceso a
        producción está limitado a las personas que operan Alika. Si tu clínica necesita un contrato
        de tratamiento de datos firmado para respaldar esa transferencia ante su propio asesor,
        escríbenos y lo firmamos.
      </LegalP>

      <LegalH2>6. Con quién compartimos datos</LegalH2>
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
      <LegalP>
        Los datos de captación de la sección 3 no suman ningún destinatario a esta lista: viven en
        la misma base de Supabase, no pasan por ninguna plataforma de marketing ni por ningún CRM de
        terceros, y no se los damos a nadie más. Tampoco los vendemos — eso vale para todo lo de
        esta página, no sólo para los datos clínicos.
      </LegalP>

      <LegalH2>7. Seguridad</LegalH2>
      <LegalP>
        Toda la comunicación viaja cifrada (HTTPS). El acceso a fichas clínicas está restringido por
        rol: recepción, por ejemplo, no puede ver notas clínicas. Los registros clínicos y del
        odontograma quedan versionados — nunca se sobrescriben, así que siempre hay un historial de
        quién cambió qué.
      </LegalP>
      <LegalP>
        Algunas cosas concretas que construimos para que esto no quede solo en un párrafo:
      </LegalP>
      <LegalUl>
        <LegalLi>
          <strong>
            Los datos de cada clínica están separados a nivel de base de datos, no solo de pantalla.
          </strong>{" "}
          No es que la app "oculte" los pacientes de otra clínica en la interfaz: es la base de
          datos misma la que impide la consulta, así que ni un bug de programación en Alika podría
          hacer que el personal de una clínica termine viendo pacientes de otra.
        </LegalLi>
        <LegalLi>
          <strong>
            Los mensajes de WhatsApp que llegan por la API se verifican criptográficamente
          </strong>{" "}
          antes de procesarse: cada mensaje entrante trae una firma que Alika valida contra un
          secreto compartido con Meta, así que un mensaje no puede hacerse pasar por tráfico
          legítimo de WhatsApp si no viene realmente de ahí.
        </LegalLi>
        <LegalLi>
          <strong>La historia clínica y el odontograma no se pueden "editar por encima".</strong>{" "}
          Cada cambio queda como una entrada nueva con quién y cuándo, no como una edición que borra
          lo anterior — si alguna vez hace falta reconstruir qué pasó con un paciente, la
          información está.
        </LegalLi>
      </LegalUl>
      <LegalP>
        Alika es una empresa chica y todavía no tiene certificaciones formales de seguridad de la
        información (por ejemplo SOC 2 o ISO 27001) — son procesos costosos que están fuera de
        alcance en esta etapa. Lo de arriba son controles que sí están construidos y en uso hoy, no
        una promesa de certificación futura.
      </LegalP>

      <LegalH2>8. Cuánto tiempo guardamos los datos</LegalH2>
      <LegalP>
        <strong>Datos de la clínica y de sus pacientes.</strong> Mientras la cuenta de la clínica
        esté activa. Si una clínica cierra su cuenta, le damos la opción de exportar sus datos antes
        de que se eliminen de nuestros sistemas. La historia clínica además tiene plazos legales de
        conservación propios en cada país: esos los define la clínica como responsable, no nosotros.
      </LegalP>
      <LegalP>
        <strong>Datos de captación.</strong> Tienen su propio plazo, más corto y con número: 24
        meses desde tu última interacción, en la sección 3.
      </LegalP>
      <LegalP>
        <strong>Eventos de medición.</strong> No llevan datos de contacto (sección 9). El hash de IP
        que acompaña al envío del formulario sólo tiene sentido dentro de la hora siguiente, que es
        la ventana del límite de envíos; pasada esa hora no lo volvemos a consultar.
      </LegalP>

      <LegalH2>9. Cookies y medición</LegalH2>
      <LegalP>
        Alika usa únicamente cookies funcionales, necesarias para que la aplicación funcione: una
        para recordar el estado de la barra lateral y otra para la sesión del portal de
        auto-agendamiento del paciente. Hoy no usamos cookies de analítica ni de publicidad.
      </LegalP>
      <LegalP>
        <strong>Cómo medimos las páginas públicas sin cookies.</strong> Contamos cuatro cosas — que
        se vio la calculadora, que se usó, que se envió el formulario y que se hizo click en un
        botón — con un identificador aleatorio que se genera al abrir la pestaña, vive en memoria y
        desaparece cuando la cierras. No queda nada guardado en tu equipo, no te seguimos entre
        visitas y no hay Google Analytics ni PostHog: la política de seguridad del sitio los bloquea
        directamente en el navegador.
      </LegalP>

      <LegalH2>10. Tus derechos</LegalH2>
      <LegalP>
        Sobre tus datos puedes pedir <strong>acceso</strong> (saber qué tenemos),{" "}
        <strong>rectificación</strong> (corregir lo que está mal), <strong>supresión</strong> (que
        lo borremos), <strong>oposición</strong> (que dejemos de usarlo para algo) y{" "}
        <strong>portabilidad</strong> (llevarte una copia en un formato que sirva). A quién se lo
        pides depende de qué relación tengas con nosotros:
      </LegalP>
      <LegalUl>
        <LegalLi>
          <strong>Si eres paciente de una clínica que usa Alika</strong>: pídeselo a tu clínica, que
          es la responsable de tus datos. Nosotros ejecutamos a nivel técnico lo que ella nos
          indique.
        </LegalLi>
        <LegalLi>
          <strong>Si eres parte del staff de una clínica</strong>: tu clínica administra tu cuenta —
          pídele a ella la corrección o la baja.
        </LegalLi>
        <LegalLi>
          <strong>Si dejaste tus datos en la calculadora o en un material</strong>: escríbenos
          directamente a nosotros, sin intermediarios. Ahí no hay ninguna clínica de por medio: el
          responsable somos nosotros y te respondemos nosotros.
        </LegalLi>
      </LegalUl>

      <LegalH2>11. Reclamar ante la Agencia</LegalH2>
      <LegalP>
        Si crees que estamos tratando mal tus datos, puedes reclamar ante la Agencia de Protección
        de Datos Personales, el organismo que crea la misma Ley 21.719 que rige en Chile desde el 1
        de diciembre de 2026. Nos gustaría que nos escribas primero para poder arreglarlo, pero no
        estás obligado: el reclamo no depende de que hables con nosotros antes.
      </LegalP>

      <LegalH2>12. Cambios a esta política</LegalH2>
      <LegalP>
        Si hacemos un cambio importante en cómo tratamos los datos, lo vamos a reflejar acá con la
        versión y la fecha actualizadas y, si corresponde, avisamos por email a las clínicas.
      </LegalP>
      <LegalUl>
        <LegalLi>
          <strong>Versión 2 — 8 de septiembre de 2026.</strong> Se agregó la sección de captación
          (sección 3) con sus finalidades separadas, la declaración de elaboración de perfiles, el
          plazo de conservación de los leads y cómo pedir la baja; las transferencias fuera de Chile
          (sección 5); la base de legitimidad de cada tratamiento; y el derecho a reclamar ante la
          Agencia (sección 11).
        </LegalLi>
        <LegalLi>
          <strong>Versión 1 — agosto de 2026.</strong> Primera versión, sólo sobre los datos de la
          clínica y de sus pacientes.
        </LegalLi>
      </LegalUl>

      <LegalH2>13. Contacto</LegalH2>
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
