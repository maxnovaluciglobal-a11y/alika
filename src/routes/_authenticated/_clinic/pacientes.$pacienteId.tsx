import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Mail, Phone, ShieldAlert, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { requirePermission } from "@/lib/route-guards";
import { PacienteTimeline } from "@/components/paciente-timeline";
import { NotasClinicas } from "@/components/notas-clinicas";
import { Odontogram } from "@/components/odontogram";
import { FinanceSection } from "@/components/finance-section";
import { MessagesHistory } from "@/components/messages-history";
import { WhatsAppOptInToggle } from "@/components/whatsapp-opt-in-toggle";
import { PortalLinkButton, RevokePortalAccessButton } from "@/components/portal-link-button";
import { ReferralCodeCard } from "@/components/referral-code-card";
import { hasPermission } from "@/lib/access";
import { formatoMoneda, type Paciente } from "@/lib/clinic-data";
import { getPatient } from "@/lib/patients.functions";

export const Route = createFileRoute("/_authenticated/_clinic/pacientes/$pacienteId")({
  // Datos demográficos (nombre, teléfono, próximo control) son de agenda/recepción,
  // no solo del equipo clínico — separado de "clinical:view" que gatea las notas.
  beforeLoad: requirePermission("patients:view"),
  loader: async ({ params, context }): Promise<{ paciente: Paciente }> => {
    const clinicId = context.access.clinic?.id;
    if (!clinicId) throw notFound();
    const paciente = await getPatient({ data: { clinicId, patientId: params.pacienteId } });
    if (!paciente) throw notFound();
    return { paciente };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Ficha no disponible | Alika" }, { name: "robots", content: "noindex" }],
      };
    }
    const titulo = `${loaderData.paciente.nombre} · Ficha clínica | Alika`;
    const desc = `Ficha clínica de ${loaderData.paciente.nombre}: timeline, saldo y próximos controles.`;
    return {
      meta: [
        { title: titulo },
        { name: "description", content: desc },
        { property: "og:title", content: titulo },
        { property: "og:description", content: desc },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  notFoundComponent: PacienteNoEncontrado,
  errorComponent: PacienteError,
  component: PacienteDetalle,
});

function PacienteNoEncontrado() {
  const { access } = Route.useRouteContext();
  return (
    <AppShell title="Paciente" access={access}>
      <p className="text-sm text-muted-foreground">
        No encontramos esa ficha.{" "}
        <Link
          to="/pacientes"
          search={{
            q: "",
            sucursal: "",
            profesional: "",
            estado: "",
            desde: "",
            hasta: "",
            page: 1,
          }}
          className="text-brand hover:underline"
        >
          Volver al listado
        </Link>
      </p>
    </AppShell>
  );
}

function PacienteError() {
  const { access } = Route.useRouteContext();
  return (
    <AppShell title="Paciente" access={access}>
      <p className="text-sm text-muted-foreground">
        No pudimos cargar la ficha.{" "}
        <Link
          to="/pacientes"
          search={{
            q: "",
            sucursal: "",
            profesional: "",
            estado: "",
            desde: "",
            hasta: "",
            page: 1,
          }}
          className="text-brand hover:underline"
        >
          Volver al listado
        </Link>
      </p>
    </AppShell>
  );
}

function PacienteDetalle() {
  const { access } = Route.useRouteContext();
  const { paciente } = Route.useLoaderData() as { paciente: Paciente };
  const puedeVerClinico = hasPermission(access.role, "clinical:view");

  return (
    <AppShell title="Ficha del paciente" access={access}>
      <div className="space-y-6">
        <Link
          to="/pacientes"
          search={{
            q: "",
            sucursal: "",
            profesional: "",
            estado: "",
            desde: "",
            hasta: "",
            page: 1,
          }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Pacientes
        </Link>

        <div className="grid gap-8 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <div className="card-clinical p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-4">
                  {paciente.foto ? (
                    <img
                      src={paciente.foto}
                      alt={paciente.nombre}
                      width={512}
                      height={512}
                      className="size-16 rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="grid size-16 place-items-center rounded-2xl bg-secondary font-display text-lg font-semibold text-muted-foreground">
                      {paciente.nombre
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                  )}
                  <div>
                    <h2 className="font-display text-2xl font-semibold">{paciente.nombre}</h2>
                    <p className="text-xs text-muted-foreground">
                      ID: {paciente.documento || "Sin documento"} • {paciente.edad} años
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {paciente.etiquetas.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Phone className="size-3.5" /> {paciente.telefono || "Sin teléfono"}
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="size-3.5" /> {paciente.email || "Sin email"}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 border-t border-hairline pt-5 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Saldo
                  </p>
                  <p className="font-display text-xl font-semibold">
                    {paciente.saldo == null
                      ? "Sin datos"
                      : paciente.saldo > 0
                        ? formatoMoneda(paciente.saldo)
                        : paciente.saldo < 0
                          ? `${formatoMoneda(-paciente.saldo)} a favor`
                          : "Al día"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Próximo control
                  </p>
                  <p className="font-display text-xl font-semibold">
                    {paciente.proximoControl ?? "Sin agendar"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Riesgo de ausencia
                  </p>
                  <p className="font-display text-xl font-semibold">
                    {paciente.riesgoAusencia == null
                      ? "Sin calcular"
                      : `${paciente.riesgoAusencia}%`}
                  </p>
                </div>
              </div>
            </div>

            {puedeVerClinico ? (
              <>
                <NotasClinicas
                  paciente={paciente}
                  clinicId={access.clinic?.id ?? null}
                  clinicaNombre={access.clinic?.name ?? "Alika"}
                  puedeEditar={hasPermission(access.role, "clinical:write")}
                  userId={access.userId}
                  rol={access.role}
                />

                {access.clinic?.id && (
                  <Odontogram
                    clinicId={access.clinic.id}
                    patientId={paciente.id}
                    puedeEditar={hasPermission(access.role, "clinical:write")}
                  />
                )}
              </>
            ) : (
              <div className="card-clinical flex items-center gap-3 p-6 text-sm text-muted-foreground">
                <ShieldAlert className="size-4 shrink-0" />
                Tu rol no tiene acceso a la historia clínica de este paciente.
              </div>
            )}

            {access.clinic?.id && (
              <FinanceSection
                clinicId={access.clinic.id}
                clinicaNombre={access.clinic.name}
                patientId={paciente.id}
                puedeEditar={hasPermission(access.role, "patients:manage")}
              />
            )}

            {access.clinic?.id && (
              <div className="space-y-2">
                <WhatsAppOptInToggle
                  clinicId={access.clinic.id}
                  patientId={paciente.id}
                  initialOptIn={paciente.waOptIn}
                />
                <MessagesHistory clinicId={access.clinic.id} patientId={paciente.id} />
              </div>
            )}

            {access.clinic?.id && hasPermission(access.role, "patients:manage") && (
              <div className="card-clinical p-6">
                <div className="mb-3">
                  <h3 className="font-display text-lg font-semibold">Portal del paciente</h3>
                  <p className="text-xs text-muted-foreground">
                    Generá un link firmado (7 días) y compartilo por WhatsApp. Sin login, sin
                    Twilio.
                  </p>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <PortalLinkButton clinicId={access.clinic.id} patientId={paciente.id} />
                  <RevokePortalAccessButton clinicId={access.clinic.id} patientId={paciente.id} />
                </div>
                <div className="mt-3">
                  <ReferralCodeCard
                    clinicId={access.clinic.id}
                    patientName={paciente.nombre}
                    referralCode={paciente.referralCode}
                  />
                </div>
              </div>
            )}

            <div className="card-clinical p-6">
              <h3 className="mb-5 font-display text-lg font-semibold">Timeline clínica</h3>
              <PacienteTimeline paciente={paciente} conEncabezado={false} />
            </div>
          </div>

          <aside className="space-y-4 xl:col-span-4">
            <div className="rounded-2xl border border-ai/15 bg-ai-soft p-5">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ai">
                <Sparkles className="size-3" /> Resumen IA
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">{paciente.resumenIA}</p>
            </div>

            <div className="card-clinical divide-y divide-hairline">
              {["Radiografías", "Consentimientos", "Presupuestos"].map((a) => (
                <button
                  key={a}
                  disabled
                  title="Próximamente"
                  className="flex w-full cursor-not-allowed items-center justify-between px-5 py-3 text-left text-sm text-muted-foreground/60"
                >
                  <span>{a}</span>
                  <span className="text-[10px] uppercase tracking-wide">Próximamente</span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
