import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  formatoFecha,
  type EstadoPaciente,
  type EventoClinico,
  type Paciente,
} from "@/lib/clinic-data";

const DB_STATUS_TO_UI: Record<string, EstadoPaciente> = {
  active: "activo",
  new: "nuevo",
  inactive: "inactivo",
};
const UI_STATUS_TO_DB: Record<EstadoPaciente, "active" | "new" | "inactive"> = {
  activo: "active",
  nuevo: "new",
  inactivo: "inactive",
};

function calcularEdad(birthDate: string): number {
  const hoy = new Date();
  const nacimiento = new Date(birthDate);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mesDiff = hoy.getMonth() - nacimiento.getMonth();
  if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad;
}

type PatientRow = {
  id: string;
  full_name: string;
  document_id: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  branch_id: string | null;
  primary_professional_id: string | null;
  status: string;
  tags: string[] | null;
  avatar_url: string | null;
  balance_cents: number | null;
  no_show_risk: number | null;
  ai_summary: string | null;
  wa_opt_in: boolean;
};

type AppointmentSlim = { patient_id: string; starts_at: string; status: string };

function ultimaYProxima(appointments: AppointmentSlim[], patientId: string) {
  const ahora = Date.now();
  const propias = appointments.filter(
    (a) => a.patient_id === patientId && a.status !== "cancelada",
  );
  const pasadas = propias.filter((a) => new Date(a.starts_at).getTime() < ahora);
  const futuras = propias.filter((a) => new Date(a.starts_at).getTime() >= ahora);
  const ultima = pasadas.sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0] ?? null;
  const proxima = futuras.sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null;
  return {
    ultimaVisita: ultima ? formatoFecha(ultima.starts_at.slice(0, 10)) : "Sin visitas",
    ultimaVisitaISO: ultima ? ultima.starts_at.slice(0, 10) : "",
    proximoControl: proxima ? formatoFecha(proxima.starts_at.slice(0, 10)) : null,
  };
}

function mapPatientRow(
  row: PatientRow,
  computed: { ultimaVisita: string; ultimaVisitaISO: string; proximoControl: string | null },
): Paciente {
  return {
    id: row.id,
    nombre: row.full_name,
    documento: row.document_id ?? "",
    edad: row.birth_date ? calcularEdad(row.birth_date) : 0,
    telefono: row.phone ?? "",
    email: row.email ?? "",
    sucursalId: row.branch_id ?? "",
    profesionalId: row.primary_professional_id ?? "",
    estado: DB_STATUS_TO_UI[row.status] ?? "nuevo",
    ultimaVisita: computed.ultimaVisita,
    ultimaVisitaISO: computed.ultimaVisitaISO,
    proximoControl: computed.proximoControl,
    saldo: row.balance_cents,
    riesgoAusencia: row.no_show_risk,
    etiquetas: row.tags ?? [],
    foto: row.avatar_url ?? undefined,
    resumenIA: row.ai_summary ?? "Aún no hay un resumen de IA para este paciente.",
    timeline: [],
    waOptIn: row.wa_opt_in,
  };
}

const PATIENT_COLUMNS =
  "id, full_name, document_id, birth_date, phone, email, branch_id, primary_professional_id, status, tags, avatar_url, balance_cents, no_show_risk, ai_summary, wa_opt_in";

/**
 * Tope de fila del listado — red de seguridad, no la estrategia de paginado
 * real (el filtro de "última visita" es un campo calculado vía RPC, no una
 * columna directa, así que paginar server-side de verdad implicaría mover
 * ese filtro a la RPC también; con el volumen actual no se justifica).
 * `truncated` le avisa a la UI que hay más pacientes de los que se trajeron,
 * en vez de fallar en silencio (ver auditoría de arquitectura 2026-08-15).
 */
const PATIENTS_ROW_LIMIT = 5_000;

/** Listado de pacientes de la clínica. RLS: solo clínicas donde el usuario es miembro.
 *
 * Antes traía TODAS las citas de la clínica (limit 5000) para calcular en JS
 * la última/próxima por paciente. O(P×A) en memoria + silencioso cap con
 * volumen real. Ahora usa la RPC `list_patients_with_last_and_next_appointment`
 * que hace el cálculo en Postgres con índice `appointments_clinic_patient_idx`
 * y devuelve solo 1 fila por paciente.
 */
export const listPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ items: Paciente[]; truncated: boolean }> => {
    const { supabase } = context;

    const [{ data: rows, error }, { data: apptRows, error: apptError }] = await Promise.all([
      supabase
        .from("patients")
        .select(PATIENT_COLUMNS)
        .eq("clinic_id", data.clinicId)
        .order("full_name", { ascending: true })
        .limit(PATIENTS_ROW_LIMIT),
      supabase.rpc("list_patients_with_last_and_next_appointment", {
        p_clinic_id: data.clinicId,
      }),
    ]);

    if (error) throw new Error(error.message);
    if (apptError) throw new Error(apptError.message);
    const truncated = (rows ?? []).length >= PATIENTS_ROW_LIMIT;

    type ApptSummary = {
      patient_id: string;
      last_appointment_at: string | null;
      next_appointment_at: string | null;
    };
    const summaryByPatient = new Map<string, ApptSummary>(
      (apptRows ?? []).map((r) => [(r as ApptSummary).patient_id, r as ApptSummary]),
    );

    const items = (rows ?? []).map((row) => {
      const s = summaryByPatient.get(row.id);
      return mapPatientRow(row as PatientRow, {
        ultimaVisita: s?.last_appointment_at
          ? formatoFecha(s.last_appointment_at.slice(0, 10))
          : "Sin visitas",
        ultimaVisitaISO: s?.last_appointment_at ? s.last_appointment_at.slice(0, 10) : "",
        proximoControl: s?.next_appointment_at
          ? formatoFecha(s.next_appointment_at.slice(0, 10))
          : null,
      });
    });
    return { items, truncated };
  });

/** Ficha de un paciente, con timeline construido desde citas reales. */
export const getPatient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ clinicId: z.string().uuid(), patientId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<Paciente | null> => {
    const { supabase } = context;

    const { data: row, error } = await supabase
      .from("patients")
      .select(PATIENT_COLUMNS)
      .eq("clinic_id", data.clinicId)
      .eq("id", data.patientId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return null;

    const { data: appts, error: apptError } = await supabase
      .from("appointments")
      .select("patient_id, professional_id, treatment_label, starts_at, status")
      .eq("clinic_id", data.clinicId)
      .eq("patient_id", data.patientId)
      .order("starts_at", { ascending: false })
      .limit(50);

    if (apptError) throw new Error(apptError.message);

    const appointments = (appts ?? []) as (AppointmentSlim & {
      professional_id: string;
      treatment_label: string;
    })[];

    const professionalIds = [...new Set(appointments.map((a) => a.professional_id))];
    const { data: professionals, error: profError } = await supabase
      .from("professionals")
      .select("id, full_name")
      .in("id", professionalIds.length ? professionalIds : [""]);
    if (profError) throw new Error(profError.message);
    const nameByProfessional = new Map((professionals ?? []).map((p) => [p.id, p.full_name]));

    const ahora = Date.now();
    const timeline: EventoClinico[] = appointments
      .filter((a) => new Date(a.starts_at).getTime() < ahora)
      .slice(0, 8)
      .map((a, i) => ({
        fecha: a.starts_at.slice(0, 10),
        titulo: a.treatment_label || "Consulta",
        detalle: [nameByProfessional.get(a.professional_id), a.status].filter(Boolean).join(" · "),
        tipo: "consulta" as const,
        actual: i === 0,
      }));

    // Saldo calculado en runtime: total facturado en treatment_items vs total
    // pagado en payments. Sobrescribe row.balance_cents (que se dejó nullable
    // en Fase 1 y ahora se ignora — la fuente de verdad es la agregación).
    const [{ data: billedRows }, { data: paidRows }] = await Promise.all([
      supabase
        .from("treatment_items")
        .select("price_cents, treatment_plans!inner(patient_id, clinic_id, status)")
        .eq("clinic_id", data.clinicId)
        .eq("treatment_plans.patient_id", data.patientId)
        .neq("treatment_plans.status", "cancelled"),
      supabase
        .from("payments")
        .select("amount_cents")
        .eq("clinic_id", data.clinicId)
        .eq("patient_id", data.patientId),
    ]);
    const totalBilled = (billedRows ?? []).reduce(
      (s, r) => s + ((r as { price_cents: number }).price_cents ?? 0),
      0,
    );
    const totalPaid = (paidRows ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);
    const balance = totalBilled - totalPaid;

    return {
      ...mapPatientRow(row as PatientRow, ultimaYProxima(appointments, data.patientId)),
      // null cuando no hay actividad financiera (nada facturado, nada pagado);
      // número (positivo = paciente debe, negativo = a favor) cuando hay algo
      saldo: totalBilled === 0 && totalPaid === 0 ? null : balance,
      timeline,
    };
  });

export const createPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        nombre: z.string().trim().min(1, "El nombre es obligatorio."),
        documento: z.string().trim().optional(),
        fechaNacimiento: z
          .string()
          .min(1, "La fecha de nacimiento es obligatoria.")
          .refine((s) => /^\d{4}-\d{2}-\d{2}/.test(s), "Formato de fecha inválido.")
          .refine((s) => {
            const d = new Date(s);
            const today = new Date();
            return d <= today;
          }, "La fecha de nacimiento no puede ser futura.")
          .refine((s) => {
            const d = new Date(s);
            return d >= new Date("1900-01-01");
          }, "Fecha de nacimiento fuera de rango."),
        telefono: z.string().trim().optional(),
        email: z.string().trim().email("Email inválido.").optional().or(z.literal("")),
        sucursalId: z.string().uuid().optional(),
        profesionalId: z.string().uuid().optional(),
        etiquetas: z.array(z.string()).default([]),
        estado: z.enum(["activo", "nuevo", "inactivo"]).default("nuevo"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase } = context;

    const { data: inserted, error } = await supabase
      .from("patients")
      .insert({
        clinic_id: data.clinicId,
        full_name: data.nombre,
        document_id: data.documento || null,
        birth_date: data.fechaNacimiento,
        phone: data.telefono || null,
        email: data.email || null,
        branch_id: data.sucursalId ?? null,
        primary_professional_id: data.profesionalId ?? null,
        tags: data.etiquetas,
        status: UI_STATUS_TO_DB[data.estado],
      })
      .select("id")
      .single();

    if (error) throw new Error("No pudimos crear el paciente. " + error.message);
    return { id: inserted.id };
  });

const IMPORT_CHUNK_SIZE = 100;

export interface ImportPatientsResult {
  created: number;
  skipped: number;
  warnings: { row: number; nombre: string; message: string }[];
  errors: { chunkFrom: number; chunkTo: number; message: string }[];
}

/**
 * Importador CSV de pacientes — palanca de adquisición para migrar desde
 * Excel/Dentalink sin cargar a mano. El CSV se parsea en el cliente
 * (papaparse); acá solo se validan y se insertan las filas ya parseadas.
 *
 * A diferencia de createPatient, fechaNacimiento es OPCIONAL: los export
 * de otros sistemas casi nunca la tienen completa para el 100% de los
 * pacientes, y birth_date ya es nullable en el schema — exigirla acá
 * tiraría filas válidas por una razón que no es de seguridad ni de datos
 * críticos (calcularEdad ya maneja null).
 *
 * Solo importa pacientes — citas queda deliberadamente fuera de esta
 * pasada: matchear profesional/sucursal/fecha desde un CSV externo sin
 * ningún control de formato es un problema bastante más grande y con
 * mucho más riesgo de dejar datos mal cargados.
 */
export const importPatients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        rows: z
          .array(
            z.object({
              nombre: z.string().trim().min(1),
              documento: z.string().trim().optional(),
              fechaNacimiento: z.string().trim().optional(),
              telefono: z.string().trim().optional(),
              email: z.string().trim().optional(),
            }),
          )
          .min(1)
          .max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ImportPatientsResult> => {
    const { supabase, userId } = context;

    const documentos = [
      ...new Set(data.rows.map((r) => r.documento?.trim()).filter((d): d is string => Boolean(d))),
    ];
    const { data: existentes, error: exError } = await supabase
      .from("patients")
      .select("document_id")
      .eq("clinic_id", data.clinicId)
      .in("document_id", documentos.length ? documentos : [""]);
    if (exError) throw new Error(exError.message);
    const yaExisten = new Set((existentes ?? []).map((e) => e.document_id));

    const warnings: ImportPatientsResult["warnings"] = [];
    let skipped = 0;
    const vistosEnEsteLote = new Set<string>();

    const paraInsertar = data.rows.flatMap((r, i) => {
      const doc = r.documento?.trim() || null;
      // Duplicado contra la DB o repetido dos veces en el mismo CSV.
      if (doc && (yaExisten.has(doc) || vistosEnEsteLote.has(doc))) {
        skipped += 1;
        return [];
      }
      if (doc) vistosEnEsteLote.add(doc);

      let birthDate: string | null = null;
      if (r.fechaNacimiento) {
        const d = new Date(r.fechaNacimiento);
        const valida = !Number.isNaN(d.getTime()) && d <= new Date() && d >= new Date("1900-01-01");
        if (valida) {
          birthDate = r.fechaNacimiento.slice(0, 10);
        } else {
          warnings.push({
            row: i + 1,
            nombre: r.nombre,
            message: "Fecha de nacimiento inválida — se importó sin ella.",
          });
        }
      }

      return [
        {
          clinic_id: data.clinicId,
          full_name: r.nombre,
          document_id: doc,
          birth_date: birthDate,
          phone: r.telefono || null,
          email: r.email || null,
          status: "new" as const,
          created_by: userId,
        },
      ];
    });

    let created = 0;
    const errors: ImportPatientsResult["errors"] = [];
    for (let i = 0; i < paraInsertar.length; i += IMPORT_CHUNK_SIZE) {
      const chunk = paraInsertar.slice(i, i + IMPORT_CHUNK_SIZE);
      const { error: insError } = await supabase.from("patients").insert(chunk);
      if (insError) {
        errors.push({
          chunkFrom: i + 1,
          chunkTo: i + chunk.length,
          message: insError.message,
        });
      } else {
        created += chunk.length;
      }
    }

    return { created, skipped, warnings, errors };
  });

export const updatePatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        patientId: z.string().uuid(),
        nombre: z.string().trim().min(1).optional(),
        documento: z.string().trim().optional(),
        telefono: z.string().trim().optional(),
        email: z.string().trim().email().optional().or(z.literal("")),
        sucursalId: z.string().uuid().optional(),
        profesionalId: z.string().uuid().optional(),
        etiquetas: z.array(z.string()).optional(),
        estado: z.enum(["activo", "nuevo", "inactivo"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { patientId, ...rest } = data;

    const patch = {
      ...(rest.nombre !== undefined && { full_name: rest.nombre }),
      ...(rest.documento !== undefined && { document_id: rest.documento || null }),
      ...(rest.telefono !== undefined && { phone: rest.telefono || null }),
      ...(rest.email !== undefined && { email: rest.email || null }),
      ...(rest.sucursalId !== undefined && { branch_id: rest.sucursalId }),
      ...(rest.profesionalId !== undefined && { primary_professional_id: rest.profesionalId }),
      ...(rest.etiquetas !== undefined && { tags: rest.etiquetas }),
      ...(rest.estado !== undefined && { status: UI_STATUS_TO_DB[rest.estado] }),
    };

    const { error } = await supabase.from("patients").update(patch).eq("id", patientId);
    if (error) throw new Error("No tienes permisos para editar este paciente.");
    return { ok: true };
  });
