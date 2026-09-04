import { useState } from "react";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CalendarClock, Mail, Phone, ShieldAlert, Tag } from "lucide-react";

import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { requirePermission } from "@/lib/route-guards";
import { PacienteTimeline } from "@/components/paciente-timeline";
import { NotasClinicas } from "@/components/notas-clinicas";
import { AllergyAlertBanner, MedicalHistoryCard } from "@/components/medical-history-card";
import { getMedicalHistory } from "@/lib/medical-history.functions";
import { listAgreements, setPatientAgreement } from "@/lib/clinic-finance.functions";
import { PatientDocumentsCard } from "@/components/patient-documents-card";
import { PatientConsentsCard } from "@/components/patient-consents-card";
import { Odontogram } from "@/components/odontogram";
import { PeriodontalChart } from "@/components/periodontal-chart";
import { FinanceSection, type PiezaSeed } from "@/components/finance-section";
import { MessagesHistory } from "@/components/messages-history";
import { WhatsAppOptInToggle } from "@/components/whatsapp-opt-in-toggle";
import { PortalLinkButton, RevokePortalAccessButton } from "@/components/portal-link-button";
import { ReferralCodeCard } from "@/components/referral-code-card";
import { hasPermission } from "@/lib/access";
import type { Paciente } from "@/lib/clinic-data";
import { formatMoney } from "@/lib/finance";
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

/**
 * Convenio del paciente en el encabezado de la ficha (Tanda B). Es un dato que
 * recepción necesita ver antes de presupuestar: define cuánto termina pagando
 * el paciente de cada prestación.
 */
function ConvenioDelPaciente({
  clinicId,
  patientId,
  convenioId,
  afiliado,
  puedeEditar,
}: {
  clinicId: string;
  patientId: string;
  convenioId: string | null;
  afiliado: string | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const fetchAgreements = useServerFn(listAgreements);
  const setFn = useServerFn(setPatientAgreement);
  const [editando, setEditando] = useState(false);
  const [seleccion, setSeleccion] = useState(convenioId ?? "");
  const [nroAfiliado, setNroAfiliado] = useState(afiliado ?? "");

  const { data: convenios = [] } = useQuery({
    queryKey: ["agreements", clinicId],
    queryFn: () => fetchAgreements({ data: { clinicId } }),
  });

  const guardar = useMutation({
    mutationFn: () =>
      setFn({
        data: {
          clinicId,
          patientId,
          agreementId: seleccion || null,
          memberId: nroAfiliado.trim() || null,
        },
      }),
    onSuccess: () => {
      // El convenio viene del loader de la ruta, no de React Query — mismo
      // motivo por el que el saldo usa router.invalidate() y no invalidateQueries.
      void router.invalidate();
      setEditando(false);
      toast.success("Convenio actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actual = convenios.find((c) => c.id === convenioId);

  if (editando) {
    return (
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Convenio</p>
        <select
          value={seleccion}
          onChange={(e) => setSeleccion(e.target.value)}
          aria-label="Convenio del paciente"
          className="w-full rounded-md border border-hairline bg-transparent px-2 py-1 text-sm outline-none focus:border-brand/50"
        >
          <option value="">Particular</option>
          {convenios.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {seleccion && (
          <input
            value={nroAfiliado}
            onChange={(e) => setNroAfiliado(e.target.value)}
            placeholder="Nº de afiliado"
            aria-label="Número de afiliado"
            className="w-full rounded-md border border-hairline bg-transparent px-2 py-1 text-xs outline-none focus:border-brand/50"
          />
        )}
        <div className="flex gap-1">
          <button
            onClick={() => guardar.mutate()}
            disabled={guardar.isPending}
            className="text-[11px] font-medium text-brand hover:underline disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            onClick={() => setEditando(false)}
            className="text-[11px] text-muted-foreground hover:underline"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Convenio</p>
      <p className="font-display text-xl font-semibold">{actual?.name ?? "Particular"}</p>
      {afiliado && <p className="text-[11px] text-muted-foreground">Afiliado {afiliado}</p>}
      {puedeEditar && (
        <button
          onClick={() => {
            setSeleccion(convenioId ?? "");
            setNroAfiliado(afiliado ?? "");
            setEditando(true);
          }}
          className="text-[11px] font-medium text-brand hover:underline"
        >
          Cambiar
        </button>
      )}
    </div>
  );
}

function PacienteDetalle() {
  const { access } = Route.useRouteContext();
  const { paciente } = Route.useLoaderData() as { paciente: Paciente };
  const currency = access.clinic?.currency ?? "CLP";
  const puedeVerClinico = hasPermission(access.role, "clinical:view");
  const clinicId = access.clinic?.id;
  const puedeFacturar = hasPermission(access.role, "patients:manage");

  // Puente odontograma → presupuesto (G-1). El `nonce` hace que clickear dos
  // veces la misma pieza vuelva a abrir el diálogo en vez de no hacer nada.
  const [piezaSeed, setPiezaSeed] = useState<PiezaSeed | null>(null);

  const fetchMedicalHistory = useServerFn(getMedicalHistory);
  const medicalHistoryQuery = useQuery({
    queryKey: ["medical-history", clinicId, paciente.id],
    queryFn: () => fetchMedicalHistory({ data: { clinicId: clinicId!, patientId: paciente.id } }),
    enabled: Boolean(clinicId) && puedeVerClinico,
  });

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
                  <p
                    className={
                      paciente.telefono && paciente.telefonoValido === false
                        ? "flex items-center gap-2 text-warning"
                        : "flex items-center gap-2"
                    }
                    title={
                      paciente.telefono && paciente.telefonoValido === false
                        ? "No pudimos confirmar que este número tenga un formato válido"
                        : undefined
                    }
                  >
                    <Phone className="size-3.5" /> {paciente.telefono || "Sin teléfono"}
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="size-3.5" /> {paciente.email || "Sin email"}
                  </p>
                </div>
              </div>

              {medicalHistoryQuery.data && medicalHistoryQuery.data.allergies.length > 0 && (
                <div className="mt-4">
                  <AllergyAlertBanner allergies={medicalHistoryQuery.data.allergies} />
                </div>
              )}

              <div className="mt-6 grid gap-4 border-t border-hairline pt-5 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Saldo
                  </p>
                  <p className="font-display text-xl font-semibold">
                    {paciente.saldo == null
                      ? "Sin datos"
                      : paciente.saldo > 0
                        ? formatMoney(paciente.saldo, currency)
                        : paciente.saldo < 0
                          ? `${formatMoney(-paciente.saldo, currency)} a favor`
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
                {access.clinic?.id && (
                  <ConvenioDelPaciente
                    clinicId={access.clinic.id}
                    patientId={paciente.id}
                    convenioId={paciente.convenioId ?? null}
                    afiliado={paciente.convenioAfiliado ?? null}
                    puedeEditar={puedeFacturar}
                  />
                )}
              </div>
            </div>

            {puedeVerClinico ? (
              <>
                {clinicId && (
                  <MedicalHistoryCard
                    clinicId={clinicId}
                    patientId={paciente.id}
                    puedeEditar={hasPermission(access.role, "clinical:write")}
                    userId={access.userId}
                  />
                )}

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
                    userId={access.userId}
                    onPresupuestarPieza={
                      puedeFacturar
                        ? (pieza) => setPiezaSeed({ ...pieza, nonce: Date.now() })
                        : undefined
                    }
                  />
                )}

                {access.clinic?.id && (
                  <PeriodontalChart
                    clinicId={access.clinic.id}
                    patientId={paciente.id}
                    puedeEditar={hasPermission(access.role, "clinical:write")}
                    userId={access.userId}
                  />
                )}

                {access.clinic?.id && (
                  <PatientDocumentsCard
                    clinicId={access.clinic.id}
                    patientId={paciente.id}
                    puedeEditar={hasPermission(access.role, "clinical:write")}
                  />
                )}

                {access.clinic?.id && (
                  <PatientConsentsCard
                    clinicId={access.clinic.id}
                    patientId={paciente.id}
                    patientName={paciente.nombre}
                    puedeEditar={hasPermission(access.role, "clinical:write")}
                    puedeGestionar={hasPermission(access.role, "patients:manage")}
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
                currency={currency}
                patientId={paciente.id}
                puedeEditar={puedeFacturar}
                userId={access.userId}
                piezaSeed={piezaSeed}
                onPiezaSeedConsumido={() => setPiezaSeed(null)}
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
            {/* Antes era "Resumen IA" — una tarjeta con `ai_summary` siempre
                null (auditoría de UI, 30-ago), en la posición más prominente
                de la ficha. `ai_summary` sigue sin generarse (no hay pipeline
                de IA todavía); mientras tanto esta tarjeta muestra un
                resumen real con datos que ya existen, en vez de una promesa
                vacía. */}
            <div className="card-clinical space-y-3 p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Resumen
              </h3>
              <div className="flex items-start gap-2 text-xs">
                <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Última visita</p>
                  <p className="font-medium">
                    {paciente.ultimaVisita || "Sin visitas registradas"}
                  </p>
                </div>
              </div>
              {paciente.etiquetas.length > 0 && (
                <div className="flex items-start gap-2 text-xs">
                  <Tag className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div className="flex flex-wrap gap-1">
                    {paciente.etiquetas.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                {paciente.waOptIn
                  ? "Acepta mensajes de seguimiento por WhatsApp (recordatorios, reseñas)."
                  : "No acepta mensajes de seguimiento por WhatsApp — solo recordatorios de cita."}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
