import { createFileRoute } from "@tanstack/react-router";
import { LegalH2, LegalP } from "@/components/legal-page";

export const Route = createFileRoute("/docs/portal-pacientes")({
  head: () => ({
    meta: [{ title: "Portal de pacientes · Documentación · Alika" }],
  }),
  component: DocsPortal,
});

function DocsPortal() {
  return (
    <article>
      <p className="text-xs font-semibold uppercase tracking-wider text-mint-strong">
        Documentación
      </p>
      <h1 className="font-precise mt-2 text-3xl font-bold tracking-tight">Portal de pacientes</h1>

      <LegalH2>Qué es</LegalH2>
      <LegalP>
        Un link que tu clínica le manda a un paciente por WhatsApp para que pida un turno o consulte
        su próxima cita, sin necesidad de crear una cuenta ni descargar nada.
      </LegalP>

      <LegalH2>Cómo se comparte</LegalH2>
      <LegalP>
        Desde la ficha del paciente o desde la agenda, generás el link del portal y se lo mandás por
        WhatsApp (manual o conectado, según el modo que uses). El link es una URL firmada con
        vencimiento — por defecto entre 7 y 14 días — así que si se filtra deja de servir por sí
        solo.
      </LegalP>

      <LegalH2>Qué puede hacer el paciente ahí</LegalH2>
      <LegalP>
        Ver sus próximas citas y pedir un nuevo turno. Las solicitudes de turno del portal aparecen
        en una bandeja dentro de la agenda de tu clínica para que el staff las confirme — no se
        agendan solas sin que alguien de tu equipo las revise. Hay un límite de 3 solicitudes por
        paciente cada 24 horas para evitar abuso del link.
      </LegalP>

      <LegalH2>Qué NO puede hacer</LegalH2>
      <LegalP>
        El portal no muestra historia clínica, odontograma ni información de pagos — solo lo
        necesario para agendar. Para ver esos datos, un paciente tiene que pedírselos directamente a
        su clínica.
      </LegalP>
    </article>
  );
}
