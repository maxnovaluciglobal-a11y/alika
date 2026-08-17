import { createFileRoute } from "@tanstack/react-router";
import { LegalH2, LegalP, LegalUl, LegalLi } from "@/components/legal-page";

export const Route = createFileRoute("/docs/primeros-pasos")({
  head: () => ({
    meta: [{ title: "Primeros pasos · Documentación · Alika" }],
  }),
  component: PrimerosPasos,
});

function PrimerosPasos() {
  return (
    <article>
      <p className="text-xs font-semibold uppercase tracking-wider text-mint-strong">
        Documentación
      </p>
      <h1 className="font-precise mt-2 text-3xl font-bold tracking-tight">Primeros pasos</h1>

      <LegalH2>1. Creá tu clínica</LegalH2>
      <LegalP>
        Desde "Empezá gratis" el onboarding te pide los datos básicos de tu clínica en 3 pasos:
        nombre, sucursal y zona horaria, y tu cuenta de dueño/a. No hace falta tarjeta para
        arrancar.
      </LegalP>

      <LegalH2>2. Cargá tus pacientes</LegalH2>
      <LegalP>
        Podés cargar pacientes uno por uno desde la ficha, o importar tu base actual con el
        importador CSV (pacientes y citas) si venías de otro sistema o de una planilla.
      </LegalP>

      <LegalH2>3. Agregá a tu equipo</LegalH2>
      <LegalP>
        Invitá al resto del personal y asignale un rol: administrador, dentista, asistente o
        recepción. El rol define qué puede ver cada persona — por ejemplo, recepción no ve notas
        clínicas.
      </LegalP>

      <LegalH2>4. Agendá tu primer turno</LegalH2>
      <LegalP>
        Desde la agenda, elegí paciente, profesional y horario. Cuando el turno esté cerca, va a
        aparecer en la cola de recordatorios de WhatsApp para que tu equipo lo despache — no hace
        falta configurar nada más para eso.
      </LegalP>

      <LegalH2>5. Sumá lo demás cuando lo necesites</LegalH2>
      <LegalP>
        El odontograma, los presupuestos, el plan de tratamiento y los pagos viven en la ficha de
        cada paciente. No es necesario configurarlos por adelantado — se usan a medida que atendés.
      </LegalP>
      <LegalUl>
        <LegalLi>
          Para conectar el número real de WhatsApp de tu clínica, ver "Conectar WhatsApp".
        </LegalLi>
        <LegalLi>Para que tus pacientes pidan turno solos, ver "Portal de pacientes".</LegalLi>
      </LegalUl>
    </article>
  );
}
