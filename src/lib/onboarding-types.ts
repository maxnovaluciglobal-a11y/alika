import { z } from "zod";

export const clinicSetupSchema = z.object({
  clinic: z.object({
    name: z.string().trim().min(2, "Nombre de la clínica requerido").max(120),
    legalName: z.string().trim().max(160).optional().or(z.literal("")),
    taxId: z.string().trim().max(40).optional().or(z.literal("")),
    country: z.string().trim().min(2).max(2),
    currency: z.string().trim().min(3).max(3),
    timezone: z.string().trim().min(3).max(60),
  }),
  branch: z.object({
    name: z.string().trim().min(2, "Nombre de la sucursal requerido").max(120),
    address: z.string().trim().max(180).optional().or(z.literal("")),
    city: z.string().trim().max(80).optional().or(z.literal("")),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
    opensAt: z.string().regex(/^\d{2}:\d{2}$/),
    closesAt: z.string().regex(/^\d{2}:\d{2}$/),
    operatories: z.array(z.string().trim().min(1).max(60)).min(1, "Agrega al menos un box"),
  }),
  specialties: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(80),
        color: z.string().trim().max(20),
        defaultDurationMin: z.number().int().min(10).max(240),
      }),
    )
    .min(1, "Selecciona al menos una especialidad"),
  professionals: z
    .array(
      z.object({
        fullName: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(160).optional().or(z.literal("")),
        licenseNumber: z.string().trim().max(60).optional().or(z.literal("")),
        specialtyName: z.string().trim().max(80).optional().or(z.literal("")),
        color: z.string().trim().max(20),
      }),
    )
    .min(1, "Agrega al menos un profesional"),
});

export type ClinicSetupInput = z.infer<typeof clinicSetupSchema>;

export type ClinicSummary = {
  id: string;
  name: string;
  role: string;
  onboardingCompleted: boolean;
};

export const COUNTRIES = [
  { code: "CL", label: "Chile", currency: "CLP", timezone: "America/Santiago" },
  { code: "MX", label: "México", currency: "MXN", timezone: "America/Mexico_City" },
  { code: "CO", label: "Colombia", currency: "COP", timezone: "America/Bogota" },
  { code: "PE", label: "Perú", currency: "PEN", timezone: "America/Lima" },
  { code: "AR", label: "Argentina", currency: "ARS", timezone: "America/Argentina/Buenos_Aires" },
] as const;

export const SPECIALTY_PRESETS = [
  { name: "Odontología general", color: "#0d9488", defaultDurationMin: 30 },
  { name: "Endodoncia", color: "#0ea5e9", defaultDurationMin: 60 },
  { name: "Ortodoncia", color: "#8b5cf6", defaultDurationMin: 30 },
  { name: "Periodoncia", color: "#f59e0b", defaultDurationMin: 45 },
  { name: "Rehabilitación oral", color: "#ec4899", defaultDurationMin: 60 },
  { name: "Cirugía maxilofacial", color: "#ef4444", defaultDurationMin: 90 },
  { name: "Odontopediatría", color: "#22c55e", defaultDurationMin: 30 },
  { name: "Implantología", color: "#6366f1", defaultDurationMin: 90 },
] as const;
