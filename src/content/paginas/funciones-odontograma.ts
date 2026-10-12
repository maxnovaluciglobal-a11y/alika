import type { PaginaContenido } from "../tipos";

export const pagina: PaginaContenido = {
  coleccion: "funciones",
  path: "/funciones/odontograma",
  titulo: "Odontograma digital FDI con historial | Esmalia",
  descripcion:
    "Odontograma digital con numeración FDI, dentición temporal, historial por pieza y paso directo al presupuesto. Se puede marcar sin internet.",
  kicker: "Funciones",
  h1: "Odontograma digital FDI, versionado y conectado al presupuesto",
  resumen:
    "El odontograma de Esmalia usa numeración FDI, con dentición permanente y temporal. Tocas una superficie (mesial, distal, oclusal, vestibular o lingual) o la pieza completa y eliges entre diez condiciones. Cada cambio crea una marca nueva y archiva la anterior, así que la historia de cada diente queda completa y con autor.",
  publicado: "2026-10-11",
  actualizado: "2026-10-11",
  autor: { nombre: "Walter La Madriz", rol: "Fundador de Esmalia" },
  secciones: [
    {
      h2: "¿Cómo se marca una pieza en el odontograma de Esmalia?",
      bloques: [
        {
          tipo: "p",
          texto:
            "El odontograma está en la ficha del paciente, en su propia pestaña. Usa numeración FDI: arriba 18 a 11 y 21 a 28, abajo 48 a 41 y 31 a 38. Un botón cambia a la dentición temporal (55 a 51, 61 a 65, 85 a 81 y 71 a 75) para odontopediatría.",
        },
        {
          tipo: "lista",
          ordenada: true,
          items: [
            "Tocas una zona del diente: mesial, distal, oclusal o incisal, vestibular, lingual o palatino. La raíz o el borde superior del dibujo marcan la pieza completa.",
            "Se abre un menú con el número, el nombre común de la pieza (por ejemplo, la 16 es el primer molar superior derecho) y la superficie elegida.",
            "Eliges la condición. El color se pinta sobre el diente y la marca queda guardada con tu nombre y la hora.",
          ],
        },
        {
          tipo: "tabla",
          columnas: ["Condición", "Dónde se marca"],
          filas: [
            [
              "Sano, caries, obturación, endodoncia, sellante, fractura",
              "En una superficie o en la pieza completa",
            ],
            ["Corona, implante, prótesis, ausente", "Solo en la pieza completa"],
          ],
          nota: "Son diez condiciones fijas, cada una con su color. La regla de pieza completa también la valida el servidor, no solo la pantalla.",
        },
        {
          tipo: "p",
          texto:
            "Si prefieres leer en vez de mirar el dibujo, la vista Tabla lista solo las piezas con alguna condición distinta de sano, con su nombre común y cada superficie marcada. Es también la alternativa accesible al diagrama para quien usa lector de pantalla.",
        },
      ],
    },
    {
      h2: "¿Qué significa que el odontograma esté versionado?",
      bloques: [
        {
          tipo: "p",
          texto:
            "Ninguna marca se sobrescribe. Cuando cambias una superficie, Esmalia guarda una marca nueva y la base de datos cierra la anterior. Nada se edita hacia atrás.",
        },
        {
          tipo: "p",
          texto:
            "El botón Ver historia muestra todas las marcas del paciente, de la más nueva a la más antigua, con quién las registró y cuándo. Las que ya no están vigentes aparecen atenuadas. Sirve para saber cuándo apareció una caries, quién marcó una pieza como ausente o qué había antes de una corona.",
        },
      ],
    },
    {
      h2: "¿Cómo pasa una pieza del odontograma al presupuesto?",
      bloques: [
        {
          tipo: "p",
          texto:
            "En el mismo menú de la pieza está el botón Presupuestar esta pieza. Abre un presupuesto nuevo con el diente y la superficie ya cargados en la primera línea. La pieza viaja con la línea: cuando el paciente acepta, el plan de tratamiento conserva el número de diente y la superficie. Más detalle en [presupuestos y plan de tratamiento](/funciones/presupuestos).",
        },
      ],
    },
    {
      h2: "¿Qué pasa si se corta internet mientras marcas?",
      bloques: [
        {
          tipo: "p",
          texto:
            "La marca se guarda en el equipo y se sincroniza sola cuando vuelve la conexión. Si marcas la misma superficie dos veces sin conexión, vale la última. Si al sincronizar resulta que otra persona cambió esa misma superficie, Esmalia no pisa nada: la deja en una bandeja de conflictos con las dos versiones para que elijas. Más en [Esmalia sin internet](/funciones/sin-internet).",
        },
      ],
    },
    {
      h2: "¿Quién lo ve y en qué plan está?",
      bloques: [
        {
          tipo: "p",
          texto:
            "Las pestañas clínicas de la ficha, incluido el odontograma, las ven propietario, administración y doctores. Recepción y contabilidad no las ven. El odontograma es parte de la [ficha clínica](/funciones/ficha-clinica), así que viene en todos los planes desde Solo (US$29 al mes) y sigue abierto aunque la prueba termine sin suscripción. Revisa los [precios](/precios) o míralo en la [demo](/demo).",
        },
        {
          tipo: "p",
          texto:
            "En la misma pestaña está el periodontograma: seis puntos por pieza para profundidad de sondaje, sangrado y recesión, más movilidad y furca por pieza.",
        },
      ],
    },
    {
      h2: "¿Qué no hace?",
      bloques: [
        {
          tipo: "aviso",
          texto:
            "**Usa solo numeración FDI.** No trae notación universal ni Palmer. Las superficies son cinco más la pieza completa, sin condiciones por raíz, y las condiciones son las diez de la lista: no se agregan propias. Marcar una caries no crea un presupuesto ni un cobro por sí solo. Y para proteger los datos, el odontograma no se guarda en el disco del equipo: si recargas la página sin internet, no lo vas a ver hasta que vuelva la conexión.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "¿Qué numeración usa el odontograma de Esmalia?",
      a: "FDI (ISO 3950): dos dígitos, cuadrante y posición. Cuadrantes 1 a 4 para la dentición permanente y 5 a 8 para la temporal. Al abrir una pieza ves también su nombre común.",
    },
    {
      q: "¿Sirve para odontopediatría?",
      a: "Sí. El botón Temporal muestra las 20 piezas de la dentición temporal con las mismas condiciones y el mismo historial.",
    },
    {
      q: "¿Se puede borrar una marca equivocada del odontograma?",
      a: "No se borra: registras la condición correcta, o Sano, y esa pasa a ser la vigente. La marca equivocada queda en la historia, atenuada. Así el registro clínico no pierde nada.",
    },
    {
      q: "¿El odontograma funciona en tablet o celular?",
      a: "Sí, desde el navegador. En pantallas chicas el odontograma se desplaza de lado para llegar a todas las piezas, y cada zona del diente tiene un área táctil mínima para tocarla con el dedo.",
    },
    {
      q: "¿Se puede marcar el odontograma sin internet?",
      a: "Sí. La marca queda en el equipo y se sincroniza sola al volver la conexión. Si otra persona cambió la misma superficie mientras tanto, decides cuál vale.",
    },
  ],
  relacionados: ["/funciones/ficha-clinica", "/funciones/presupuestos", "/funciones/sin-internet"],
  enUnaLinea:
    "Odontograma FDI permanente y temporal, versionado por superficie, con historial y paso directo al presupuesto.",
};
