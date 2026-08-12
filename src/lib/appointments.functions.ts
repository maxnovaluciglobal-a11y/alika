import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { HORA_INICIO, type Cita, type EstadoCita } from "@/lib/clinic-data";

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
 * Citas de la clínica (excluye canceladas). Sin límite de fecha por ahora: el
 * volumen de una clínica que recién arranca es bajo; el filtro de fecha lo
 * sigue aplicando la UI, igual que con el fixture que reemplaza.
 */
export const listAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinicId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<Cita[]> => {
    const { supabase } = context;

    const { data: rows, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_COLUMNS)
      .eq("clinic_id", data.clinicId)
      .neq("status", "cancelada")
      .order("starts_at", { ascending: true })
      .limit(3000);

    if (error) throw new Error(error.message);

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

    return appointments.map((row) =>
      mapAppointmentRow(
        row,
        nameByPatient.get(row.patient_id) ?? "Paciente",
        tzByBranch.get(row.branch_id) || DEFAULT_TIMEZONE,
      ),
    );
  });

export const createAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        branchId: z.string().uuid(),
        patientId: z.string().uuid(),
        professionalId: z.string().uuid(),
        tratamiento: z.string().trim().min(1, "Indica el tratamiento o motivo."),
        // Valor de <input type="datetime-local">, sin zona horaria explícita.
        // Simplificación de fase 1: se interpreta en la zona horaria del servidor,
        // no en la de la sucursal. Suficiente mientras haya una sola sucursal por
        // despliegue; a revisar cuando haya clínicas multi-huso horario reales.
        startsAt: z.string().min(1, "Falta la fecha y hora de inicio."),
        duracionMin: z.number().int().min(5).max(480),
        prioridad: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new Error("Fecha/hora de inicio inválida.");
    const endsAt = new Date(startsAt.getTime() + data.duracionMin * 60_000);

    const { data: inserted, error } = await context.supabase
      .from("appointments")
      .insert({
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

    if (error) throw new Error("No pudimos crear la cita. " + error.message);
    return { id: inserted.id };
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
