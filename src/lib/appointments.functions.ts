import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { HORA_INICIO, type Cita, type EstadoCita } from "@/lib/clinic-data";
import { filaYaCreada } from "@/lib/idempotency";

const DEFAULT_TIMEZONE = "America/Santiago";

type AppointmentRow = {
  id: string;
  patient_id: string;
  professional_id: string;
  branch_id: string;
  treatment_label: string;
  starts_at: string;
  ends_at: string;
  status: string;
  is_priority: boolean;
};

function fechaLocal(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function minutosDesdeInicio(iso: string, timeZone: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const h = Number(partes.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const m = Number(partes.find((p) => p.type === "minute")?.value ?? "0");
  return (h - HORA_INICIO) * 60 + m;
}

function mapAppointmentRow(row: AppointmentRow, pacienteNombre: string, timeZone: string): Cita {
  const duracion = Math.round(
    (new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()) / 60_000,
  );
  return {
    id: row.id,
    pacienteId: row.patient_id,
    paciente: pacienteNombre,
    tratamiento: row.treatment_label || "Consulta",
    profesionalId: row.professional_id,
    sucursalId: row.branch_id,
    fecha: fechaLocal(row.starts_at, timeZone),
    inicio: minutosDesdeInicio(row.starts_at, timeZone),
    duracion,
    estado: row.status as EstadoCita,
    prioridad: row.is_priority || undefined,
  };
}

const APPOINTMENT_COLUMNS =
  "id, patient_id, professional_id, branch_id, treatment_label, starts_at, ends_at, status, is_priority";

/**
 * Tope de fila del listado. El filtro de fecha lo sigue aplicando la UI (así
 * "Todas las fechas" sigue andando), así que esto es una red de seguridad,
 * no la estrategia de paginado real — con miles de citas/año, `truncated`
 * le avisa a la UI que hay más datos de los que se trajeron, en vez de
 * fallar en silencio como antes (ver auditoría de arquitectura 2026-08-15).
 */
const APPOINTMENTS_ROW_LIMIT = 10_000;

/** Citas de la clínica (excluye canceladas). */
export const listAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ items: Cita[]; truncated: boolean }> => {
    const { supabase } = context;

    const { data: rows, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_COLUMNS)
      .eq("clinic_id", data.clinicId)
      .neq("status", "cancelada")
      // Descendente a propósito: si el tope de fila corta la lista, que se
      // pierda historial viejo y no la agenda futura (ver auditoría
      // architecture-6). Los consumidores (agenda.tsx, dashboard.tsx)
      // vuelven a ordenar ascendente por fecha/hora antes de mostrar, así
      // que este orden crudo no les afecta.
      .order("starts_at", { ascending: false })
      .limit(APPOINTMENTS_ROW_LIMIT);

    if (error) throw new Error(error.message);
    const truncated = (rows ?? []).length >= APPOINTMENTS_ROW_LIMIT;

    const appointments = (rows ?? []) as AppointmentRow[];
    const patientIds = [...new Set(appointments.map((a) => a.patient_id))];
    const branchIds = [...new Set(appointments.map((a) => a.branch_id))];

    const [{ data: patients, error: patError }, { data: branches, error: branchError }] =
      await Promise.all([
        supabase
          .from("patients")
          .select("id, full_name")
          .in("id", patientIds.length ? patientIds : [""]),
        supabase
          .from("branches")
          .select("id, timezone")
          .in("id", branchIds.length ? branchIds : [""]),
      ]);
    if (patError) throw new Error(patError.message);
    if (branchError) throw new Error(branchError.message);

    const nameByPatient = new Map((patients ?? []).map((p) => [p.id, p.full_name]));
    const tzByBranch = new Map((branches ?? []).map((b) => [b.id, b.timezone]));

    return {
      items: appointments.map((row) =>
        mapAppointmentRow(
          row,
          nameByPatient.get(row.patient_id) ?? "Paciente",
          tzByBranch.get(row.branch_id) || DEFAULT_TIMEZONE,
        ),
      ),
      truncated,
    };
  });

/**
 * Interpreta un wall-clock local "YYYY-MM-DDTHH:mm[:ss]" (formato del
 * <input type="datetime-local">) como ese mismo instante en la timezone
 * dada y devuelve el Date en UTC. Sin luxon: usa Intl.DateTimeFormat
 * para descubrir el offset UTC en esa fecha concreta (respeta DST).
 */
export function wallTimeInTzToUtc(localIso: string, timeZone: string): Date {
  const normalized = localIso.length === 16 ? localIso + ":00" : localIso;
  // Interpretar el string como si fuera UTC → medir cuánto se aleja al
  // renderizarlo en la timezone objetivo. El delta es el offset.
  const asUtc = new Date(normalized + "Z");
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(asUtc).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMs = asIfUtc - asUtc.getTime();
  return new Date(asUtc.getTime() - offsetMs);
}

/** Aviso de doble-booking devuelto al front — no bloquea, solo informa. */
export type Solapamiento = { treatmentLabel: string; startsAt: string; endsAt: string };

export const createAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        // Lo genera el cliente cuando la cita se capturó sin conexión, para
        // que reintentar la cola no cree la misma cita dos veces (ver el
        // manejo de 23505 más abajo). Online no se manda y lo pone la DB.
        id: z.string().uuid().optional(),
        clinicId: z.string().uuid(),
        branchId: z.string().uuid(),
        patientId: z.string().uuid(),
        professionalId: z.string().uuid(),
        tratamiento: z.string().trim().min(1, "Indica el tratamiento o motivo."),
        // Valor crudo del <input type="datetime-local"> ("YYYY-MM-DDTHH:mm").
        // Se interpreta como wall-clock EN LA TIMEZONE DE LA SUCURSAL, no del
        // servidor. En Vercel el server corre en UTC — sin este fix las citas
        // creadas por recepción en Santiago quedaban corridas 3-4 hrs.
        startsAt: z.string().min(1, "Falta la fecha y hora de inicio."),
        duracionMin: z.number().int().min(5).max(480),
        prioridad: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string; solapamiento?: Solapamiento }> => {
    const { data: branch, error: branchErr } = await context.supabase
      .from("branches")
      .select("timezone")
      .eq("clinic_id", data.clinicId)
      .eq("id", data.branchId)
      .maybeSingle();
    if (branchErr) throw new Error(branchErr.message);
    if (!branch) throw new Error("La sucursal no existe o no es tuya.");
    const timeZone = branch.timezone || DEFAULT_TIMEZONE;

    const startsAt = wallTimeInTzToUtc(data.startsAt, timeZone);
    if (Number.isNaN(startsAt.getTime())) throw new Error("Fecha/hora de inicio inválida.");
    const endsAt = new Date(startsAt.getTime() + data.duracionMin * 60_000);

    // Aviso SOFT de doble-booking, no bloqueo duro (mismo criterio que Open
    // Dental): dos citas del mismo profesional cuyos rangos se cruzan. No
    // usamos operatory_id como unidad de colisión porque createAppointment
    // nunca lo setea todavía (siempre null) — professional_id es la unidad
    // real hoy. Corre ANTES del insert para no tener que revertir nada.
    // Importa más ahora que la app es offline-first: dos recepcionistas
    // pueden estar cargando en paralelo sin verse.
    // `starts_at < endsAt AND ends_at > startsAt` es la condición estándar de
    // solapamiento de intervalos — la evalúa la propia query, no hace falta
    // traer candidatas y filtrar en JS.
    const { data: choques, error: choquesErr } = await context.supabase
      .from("appointments")
      .select("treatment_label, starts_at, ends_at")
      .eq("clinic_id", data.clinicId)
      .eq("professional_id", data.professionalId)
      .neq("status", "cancelada")
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", startsAt.toISOString())
      .limit(1);
    if (choquesErr) throw new Error(choquesErr.message);
    const choque = choques?.[0];
    const solapamiento: Solapamiento | undefined = choque
      ? {
          treatmentLabel: choque.treatment_label || "Consulta",
          startsAt: choque.starts_at,
          endsAt: choque.ends_at,
        }
      : undefined;

    const { data: inserted, error } = await context.supabase
      .from("appointments")
      .insert({
        ...(data.id ? { id: data.id } : {}),
        clinic_id: data.clinicId,
        branch_id: data.branchId,
        patient_id: data.patientId,
        professional_id: data.professionalId,
        treatment_label: data.tratamiento,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        is_priority: data.prioridad ?? false,
      })
      .select("id")
      .single();

    if (error) {
      const yaEstaba = await filaYaCreada(
        context.supabase,
        "appointments",
        data.id,
        data.clinicId,
        error,
      );
      if (yaEstaba) return { id: yaEstaba };
      throw new Error("No pudimos crear la cita. " + error.message);
    }
    return { id: inserted.id, solapamiento };
  });

export const setAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        appointmentId: z.string().uuid(),
        estado: z.enum([
          "tentativa",
          "confirmada",
          "en-sala",
          "ausente",
          "finalizada",
          "cancelada",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("appointments")
      .update({ status: data.estado })
      .eq("id", data.appointmentId);
    if (error) throw new Error("No tienes permisos para actualizar esta cita.");
    return { ok: true };
  });
