/** Plantillas de notas clínicas por especialidad y motivo de consulta. */

export interface NoteTemplate {
  id: string;
  specialty: string;
  motivo: string;
  title: string;
  /** Esqueleto que se inserta en el editor. */
  scaffold: string;
  /** Guía adicional que recibe la IA para respetar el formato. */
  guidance: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "general-control",
    specialty: "Odontología general",
    motivo: "Control periódico",
    title: "Control periódico",
    scaffold: [
      "S) Motivo de consulta: control de rutina.",
      "- Molestias referidas:",
      "- Higiene y hábitos:",
      "",
      "O) Examen clínico:",
      "- Tejidos blandos:",
      "- Piezas con caries / obturaciones defectuosas:",
      "- Índice de placa / sangrado:",
      "",
      "A) Impresión diagnóstica:",
      "",
      "P) Plan:",
      "- Procedimientos hoy:",
      "- Próximo control:",
    ].join("\n"),
    guidance:
      "Nota de control periódico: prioriza hallazgos por pieza (notación FDI), estado de higiene y periodicidad del próximo control.",
  },
  {
    id: "general-urgencia",
    specialty: "Odontología general",
    motivo: "Urgencia por dolor",
    title: "Urgencia dental",
    scaffold: [
      "S) Dolor: inicio / intensidad (EVA 0-10) / carácter / desencadenantes:",
      "- Medicación tomada:",
      "",
      "O) Examen:",
      "- Pieza afectada (FDI):",
      "- Pruebas: percusión / palpación / frío / vitalidad:",
      "- Imagenología:",
      "",
      "A) Diagnóstico presuntivo:",
      "",
      "P) Manejo de urgencia y derivación:",
    ].join("\n"),
    guidance:
      "Nota de urgencia: consigna escala de dolor EVA, pruebas diagnósticas realizadas y el manejo inmediato. Sé explícito con la pieza en notación FDI.",
  },
  {
    id: "endodoncia-tratamiento",
    specialty: "Endodoncia",
    motivo: "Tratamiento de conducto",
    title: "Sesión de endodoncia",
    scaffold: [
      "S) Sintomatología previa:",
      "",
      "O) Pieza (FDI):",
      "- Diagnóstico pulpar / periapical:",
      "- Anestesia:",
      "- Aislamiento absoluto:",
      "- Conductos localizados y longitud de trabajo:",
      "- Irrigación e instrumentación:",
      "- Medicación intraconducto / obturación:",
      "",
      "A) Evolución:",
      "",
      "P) Próxima sesión / rehabilitación definitiva:",
    ].join("\n"),
    guidance:
      "Nota endodóntica: registra diagnóstico pulpar y periapical, número de conductos, longitud de trabajo, protocolo de irrigación y estado de obturación.",
  },
  {
    id: "periodoncia-mantencion",
    specialty: "Periodoncia",
    motivo: "Mantención periodontal",
    title: "Mantención periodontal",
    scaffold: [
      "S) Síntomas: sangrado / movilidad / sensibilidad:",
      "",
      "O) Periodontograma:",
      "- Profundidad de sondaje relevante:",
      "- Sangrado al sondaje (%):",
      "- Placa (%) / cálculo:",
      "- Movilidad y furcas:",
      "",
      "A) Diagnóstico periodontal (estadio y grado):",
      "",
      "P) Terapia realizada e indicaciones de higiene. Próxima mantención:",
    ].join("\n"),
    guidance:
      "Nota periodontal: incluye porcentajes de placa y sangrado, sitios con sondaje ≥4 mm, estadio/grado y el intervalo de mantención.",
  },
  {
    id: "ortodoncia-control",
    specialty: "Ortodoncia",
    motivo: "Control de aparatología",
    title: "Control de ortodoncia",
    scaffold: [
      "S) Reporte del paciente (molestias, uso de elásticos, alineadores):",
      "",
      "O) Aparatología y estado:",
      "- Arcos / alineador n.º:",
      "- Piezas despegadas o daños:",
      "- Higiene:",
      "",
      "A) Avance respecto al objetivo:",
      "",
      "P) Ajustes realizados, indicaciones y próximo control:",
    ].join("\n"),
    guidance:
      "Nota de ortodoncia: consigna arco o número de alineador, cambios realizados, cumplimiento del paciente y próximo control en semanas.",
  },
  {
    id: "cirugia-exodoncia",
    specialty: "Cirugía oral",
    motivo: "Exodoncia",
    title: "Exodoncia",
    scaffold: [
      "S) Antecedentes médicos relevantes y consentimiento informado:",
      "",
      "O) Pieza (FDI) e indicación:",
      "- Anestesia (tipo y cantidad):",
      "- Técnica: simple / quirúrgica, colgajo, osteotomía, odontosección:",
      "- Hemostasia y sutura:",
      "",
      "A) Evolución intraoperatoria y complicaciones:",
      "",
      "P) Indicaciones postoperatorias, fármacos y control de sutura:",
    ].join("\n"),
    guidance:
      "Nota quirúrgica: deja constancia del consentimiento informado, técnica anestésica y quirúrgica, complicaciones e indicaciones postoperatorias.",
  },
  {
    id: "odontopediatria-primera",
    specialty: "Odontopediatría",
    motivo: "Primera consulta infantil",
    title: "Primera consulta odontopediátrica",
    scaffold: [
      "S) Acompañante y motivo. Antecedentes de embarazo/lactancia, hábitos y dieta:",
      "",
      "O) Conducta (escala de Frankl):",
      "- Dentición y erupción:",
      "- Caries / manchas blancas:",
      "- Frenillos y oclusión:",
      "",
      "A) Riesgo cariogénico:",
      "",
      "P) Preventivo (flúor, sellantes), educación a cuidadores y próximo control:",
    ].join("\n"),
    guidance:
      "Nota odontopediátrica: usa lenguaje orientado a cuidadores, registra conducta (Frankl), riesgo cariogénico y medidas preventivas.",
  },
  {
    id: "rehabilitacion-protesis",
    specialty: "Rehabilitación oral",
    motivo: "Prótesis fija",
    title: "Sesión de rehabilitación",
    scaffold: [
      "S) Expectativa del paciente y estado de la restauración previa:",
      "",
      "O) Piezas involucradas (FDI):",
      "- Etapa: tallado / impresión / prueba / instalación:",
      "- Materiales y color:",
      "- Ajuste oclusal y márgenes:",
      "",
      "A) Observaciones:",
      "",
      "P) Envío a laboratorio / próxima etapa e indicaciones:",
    ].join("\n"),
    guidance:
      "Nota de rehabilitación: identifica etapa protésica, piezas en notación FDI, materiales, color y ajustes oclusales.",
  },
];

export const NOTE_TEMPLATE_SPECIALTIES = [...new Set(NOTE_TEMPLATES.map((t) => t.specialty))];

export function getNoteTemplate(id: string | null | undefined) {
  if (!id) return null;
  return NOTE_TEMPLATES.find((t) => t.id === id) ?? null;
}
