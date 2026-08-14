export const CLINIC_ROLES = [
  "owner",
  "admin",
  "dentist",
  "assistant",
  "reception",
  "accounting",
] as const;

export type ClinicRole = (typeof CLINIC_ROLES)[number];

export const ROLE_LABELS: Record<ClinicRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  dentist: "Doctor/a",
  assistant: "Asistente dental",
  reception: "Recepción",
  accounting: "Contabilidad",
};

export const ROLE_DESCRIPTIONS: Record<ClinicRole, string> = {
  owner: "Control total de la clínica, equipo y facturación.",
  admin: "Gestiona clínica, equipo, agenda y pacientes.",
  dentist: "Agenda, pacientes e historia clínica de sus tratamientos.",
  assistant: "Apoyo clínico: ve agenda y ficha básica del paciente.",
  reception: "Agenda, contacto y datos administrativos del paciente.",
  accounting: "Indicadores, tratamientos y finanzas, sin historia clínica.",
};

export const PERMISSIONS = [
  "dashboard:view",
  "agenda:view",
  "agenda:manage",
  "patients:view",
  "patients:manage",
  "clinical:view",
  "clinical:write",
  "treatments:view",
  "team:view",
  "team:manage",
  "settings:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<ClinicRole, Permission[]> = {
  owner: [...PERMISSIONS],
  admin: [...PERMISSIONS],
  dentist: [
    "dashboard:view",
    "agenda:view",
    "agenda:manage",
    "patients:view",
    "patients:manage",
    "clinical:view",
    "clinical:write",
    "treatments:view",
    "team:view",
  ],
  assistant: ["dashboard:view", "agenda:view", "patients:view", "treatments:view"],
  reception: [
    "dashboard:view",
    "agenda:view",
    "agenda:manage",
    "patients:view",
    "patients:manage",
    "treatments:view",
    "team:view",
  ],
  accounting: ["dashboard:view", "patients:view", "treatments:view", "team:view"],
};

export function permissionsForRole(role: ClinicRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: ClinicRole | null | undefined, permission: Permission) {
  if (!role) return false;
  return permissionsForRole(role).includes(permission);
}

export function isClinicRole(value: string): value is ClinicRole {
  return (CLINIC_ROLES as readonly string[]).includes(value);
}

export type ClinicAccess = {
  userId: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  clinic: {
    id: string;
    name: string;
    onboardingCompleted: boolean;
    /** IANA timezone (ej. "America/Santiago"). Fallback a Santiago si la clínica no lo tiene seteado. */
    timezone: string;
  } | null;
  /** Rol vigente en la interfaz: el real, o el simulado si el admin activó la simulación. */
  role: ClinicRole | null;
  /** Rol real del usuario en la clínica (autoritativo, el que aplica en RLS). */
  realRole?: ClinicRole | null;
  /** Rol simulado activo (solo interfaz). */
  simulatedRole?: ClinicRole | null;
};


export type ClinicMember = {
  id: string;
  userId: string;
  role: ClinicRole;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
};
