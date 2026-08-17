import { createFileRoute } from "@tanstack/react-router";
import { LegalH2, LegalP, LegalNotice } from "@/components/legal-page";

export const Route = createFileRoute("/docs/whatsapp")({
  head: () => ({
    meta: [{ title: "Conectar WhatsApp · Documentación · Alika" }],
  }),
  component: DocsWhatsapp,
});

function DocsWhatsapp() {
  return (
    <article>
      <p className="text-xs font-semibold uppercase tracking-wider text-mint-strong">
        Documentación
      </p>
      <h1 className="font-precise mt-2 text-3xl font-bold tracking-tight">Conectar WhatsApp</h1>

      <LegalNotice>
        En ningún modo Alika manda un mensaje sin que alguien de tu clínica lo dispare. La cola de
        recordatorios y avisos siempre pasa por revisión de tu equipo antes de salir.
      </LegalNotice>

      <LegalH2>Modo manual (wa.me) — funciona desde el primer día</LegalH2>
      <LegalP>
        Sin configurar nada, cuando hay un recordatorio, un aviso de lista de espera o un
        seguimiento de presupuesto pendiente, Alika arma el mensaje y te abre WhatsApp Web o la app
        con el texto ya escrito. Vos revisás y apretás enviar. Es el modo por defecto y siempre
        queda disponible como respaldo, incluso si conectás tu número.
      </LegalP>

      <LegalH2>Modo conectado (número real de tu clínica)</LegalH2>
      <LegalP>
        Desde "Conectar número" en la sección de WhatsApp podés vincular el WhatsApp Business de tu
        clínica. Con el número conectado, los mensajes salen desde tu propio número (no desde uno
        genérico) y se puede automatizar más el despacho de plantillas ya aprobadas. Los mensajes
        entrantes de números que no son pacientes tuyos quedan guardados como "lead nuevo" para que
        tu equipo los revise.
      </LegalP>

      <LegalH2>Qué se envía por WhatsApp</LegalH2>
      <LegalP>
        Recordatorios de turno (48h y 3h antes), avisos de lista de espera cuando se libera un
        hueco, seguimiento de presupuestos enviados sin respuesta, y — si tu clínica lo activa —
        saludos de cumpleaños, seguimiento post-tratamiento e invitaciones a referir. Todo respeta
        el opt-in del paciente: si un paciente responde BAJA o STOP, deja de recibir estos mensajes.
      </LegalP>
    </article>
  );
}
