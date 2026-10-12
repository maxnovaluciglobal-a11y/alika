import type { PaginaContenido } from "../tipos";

export const pagina: PaginaContenido = {
  coleccion: "funciones",
  path: "/funciones/patty-ia",
  titulo: "Patty: IA para dentistas con límites claros | Esmalia",
  descripcion:
    "Patty, la IA de Esmalia, pasa tus apuntes a una nota SOAP y resume la nota clínica. No firma, no escribe a pacientes ni mueve la agenda.",
  kicker: "Funciones",
  h1: "Patty, la IA de Esmalia para dentistas: qué hace y qué no",
  resumen:
    "Patty es la IA de Esmalia. Redacta una nota SOAP a partir de tus apuntes, pule la redacción, resume la nota en un párrafo y tres puntos, extrae diagnósticos, tratamientos, medicamentos y alergias para que los confirmes. Propone; el profesional revisa y firma. Con el número de WhatsApp de la clínica conectado (en habilitación), también leerá los pedidos de hora que las reglas no entienden.",
  publicado: "2026-10-11",
  actualizado: "2026-10-11",
  autor: { nombre: "Walter La Madriz", rol: "Fundador de Esmalia" },
  secciones: [
    {
      h2: "¿Qué hace Patty dentro de Esmalia?",
      bloques: [
        {
          tipo: "aviso",
          texto:
            "**La lectura de WhatsApp está en habilitación.** Necesita el número de la clínica conectado a WhatsApp Business (Meta), que todavía no está activo. Lo que Patty hace hoy está en el editor de notas clínicas.",
        },
        {
          tipo: "p",
          texto:
            "Patty es el nombre de la IA de Esmalia. Trabaja en dos lugares: el editor de notas clínicas y los mensajes de WhatsApp que llegan al número conectado de la clínica. En la interfaz, lo que hizo Patty se ve en color violeta, y ese color no significa otra cosa.",
        },
        {
          tipo: "tabla",
          columnas: ["Acción", "Qué recibe", "Qué devuelve"],
          filas: [
            [
              "Redactar nota SOAP",
              "Tus apuntes, un contexto breve del paciente y la plantilla, si elegiste una",
              "Una nota en Subjetivo, Objetivo, Análisis y Plan. Lo que falta queda como “no consignado”.",
            ],
            [
              "Pulir",
              "La nota escrita",
              "La misma nota con mejor redacción y ortografía, sin hechos nuevos.",
            ],
            [
              "Resumir",
              "La nota",
              "Un párrafo de hasta 80 palabras y tres puntos: hallazgos, procedimiento y próximo paso.",
            ],
            [
              "Estructurar",
              "La nota",
              "Diagnósticos, tratamientos, medicamentos y alergias, con pieza FDI y nivel de confianza, para confirmarlos uno por uno.",
            ],
            [
              "Leer pedidos de hora",
              "Un mensaje de WhatsApp de hasta 500 caracteres y la fecha de hoy en la clínica",
              "Si el paciente pide, mueve o cancela una hora, para qué día y en qué franja.",
            ],
          ],
          nota: "El contexto del paciente incluye nombre, edad, etiquetas, última visita y los últimos eventos de su ficha.",
        },
      ],
    },
    {
      h2: "¿Cuáles son los límites de Patty?",
      bloques: [
        {
          tipo: "lista",
          items: [
            "**No firma.** El texto de Patty aparece en el editor como borrador. Se guarda cuando tú guardas, y firmar es de doctores y administración. La versión queda marcada como asistida por IA.",
            "**No le escribe a pacientes.** No existe un camino por el que Patty mande un mensaje. Todo WhatsApp lo dispara una persona.",
            "**No mueve la agenda.** Si lee que un paciente pide hora con una fecha clara, deja una solicitud pendiente en la agenda, igual que las reglas. Mover o cancelar solo genera un aviso al equipo. Nunca confirma una cita.",
            "**No diagnostica.** Sus instrucciones le prohíben inventar datos, dar diagnósticos definitivos o prescribir. Redacta a partir de lo que registró el profesional y pone un código clínico solo si aparece escrito en la nota.",
            "**Lo que extrae no vale hasta que lo confirmas.** Cada diagnóstico o alergia estructurada queda sin confirmar; lo validas o lo borras.",
            "**Queda registro.** Cada uso de la IA en una nota se anota en la auditoría de esa nota, y ese registro lo escribe la base de datos.",
          ],
        },
      ],
    },
    {
      h2: "¿Por qué las reglas leen primero los mensajes de WhatsApp?",
      bloques: [
        {
          tipo: "p",
          texto:
            "La mayoría de los mensajes de pacientes son cortos y previsibles, del tipo “quiero hora para el jueves en la tarde”. Esmalia los lee con reglas fijas, que no cuestan nada y responden siempre igual. Patty entra solo cuando las reglas no pueden leer el mensaje con confianza, por ejemplo si es largo o ambiguo. Si Patty tampoco está segura, no hace nada y el mensaje queda para que lo lea una persona.",
        },
        {
          tipo: "p",
          texto:
            "La razón es que los dos errores no cuestan lo mismo. Un mensaje que queda en la bandeja se resuelve leyéndolo. Una solicitud de hora que el paciente nunca pidió hace que alguien de la clínica pierda tiempo llamándolo. Cuando la lectura viene de Patty, el aviso al equipo empieza con “Patty leyó:”, para que se sepa quién la interpretó. Más sobre este circuito en [recordatorios por WhatsApp](/funciones/recordatorios-whatsapp).",
        },
      ],
    },
    {
      h2: "¿Qué datos ve Patty y adónde van?",
      bloques: [
        {
          tipo: "p",
          texto:
            "Para redactar, Esmalia envía al proveedor de IA configurado (Google Gemini u OpenAI) lo que esa tarea necesita: tus apuntes o la nota y el contexto breve del paciente. Para leer un pedido de hora, envía el texto del mensaje y la fecha. En las notas, solo los roles clínicos pueden usar Patty: propietario, administración, doctores y asistentes. Más sobre el manejo de datos en [datos y seguridad](/docs/datos-y-seguridad).",
        },
      ],
    },
    {
      h2: "¿En qué plan está Patty?",
      bloques: [
        {
          tipo: "p",
          texto:
            "Las funciones de notas están en la [ficha clínica](/funciones/ficha-clinica), que viene en todos los planes desde Solo (US$29 al mes). La lectura de WhatsApp necesita el número de la clínica conectado a Meta, que durante la prueba se habilita al agendar la llamada de puesta en marcha o al suscribirte. Si la IA no responde en un momento dado, el editor te lo dice y el mensaje de WhatsApp llega al equipo con el aviso de siempre. Revisa los [precios](/precios).",
        },
      ],
    },
    {
      h2: "¿Qué no hace?",
      bloques: [
        {
          tipo: "aviso",
          texto:
            "**Patty propone, no decide.** No firma notas, no le escribe a ningún paciente, no confirma, mueve ni cancela citas y no toma decisiones clínicas. No reemplaza tu criterio: revisa siempre lo que redacta antes de guardar. Tampoco funciona sin internet, porque corre en el servidor.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "¿Patty puede hacer diagnósticos?",
      a: "No. Redacta, pule, resume y ordena lo que tú registraste. Tiene prohibido dar diagnósticos definitivos o prescripciones, y lo que estructura queda sin confirmar hasta que lo validas.",
    },
    {
      q: "¿Patty confirma citas por WhatsApp?",
      a: "No. Puede leer que un paciente pide, mueve o cancela una hora y avisarle al equipo. Lo más que hace es dejar una solicitud pendiente en la agenda cuando el paciente pide hora con una fecha clara. Confirmar es del profesional.",
    },
    {
      q: "¿Lo que escribe Patty se guarda solo?",
      a: "No. El texto aparece en el editor con el aviso “Revisa y ajusta antes de guardar”. Se guarda cuando tú guardas, como una versión nueva marcada como asistida por IA.",
    },
    {
      q: "¿Qué pasa si Patty extrae mal un diagnóstico?",
      a: "Lo borras o no lo confirmas. Los campos extraídos por IA quedan pendientes hasta que alguien los valida, y cada confirmación o borrado queda en la auditoría de la nota.",
    },
    {
      q: "¿Qué modelo de IA usa Patty?",
      a: "Esmalia se conecta a Google Gemini o a OpenAI, según la configuración del servicio. El modelo cambia cómo se escribe el texto, no los límites: esos están en el código de Esmalia.",
    },
  ],
  relacionados: [
    "/funciones/ficha-clinica",
    "/funciones/recordatorios-whatsapp",
    "/funciones/odontograma",
  ],
  enUnaLinea:
    "Patty, la IA de Esmalia: redacta notas SOAP y resume la nota clínica. No firma ni decide.",
};
