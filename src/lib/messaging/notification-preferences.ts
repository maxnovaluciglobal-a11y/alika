/** Tipos de evento que pueden generar un aviso por email. */
export const EMAIL_EVENTS = [
  {
    key: "email_review_requested",
    kind: "review_requested",
    label: "Revisión solicitada",
    description: "Te asignan una nota clínica firmada para revisar.",
  },
  {
    key: "email_review_approved",
    kind: "review_approved",
    label: "Nota aprobada",
    description: "Un revisor aprueba una nota que enviaste.",
  },
  {
    key: "email_review_changes_requested",
    kind: "review_changes_requested",
    label: "Cambios solicitados",
    description: "Un revisor pide ajustes antes de aprobar la nota.",
  },
  {
    key: "email_review_comment",
    kind: "review_comment",
    label: "Nuevo comentario",
    description: "Alguien comenta dentro del flujo de revisión.",
  },
  {
    key: "email_review_cancelled",
    kind: "review_cancelled",
    label: "Revisión cancelada",
    description: "Se cancela una solicitud de revisión en curso.",
  },
  {
    key: "email_note_reverted",
    kind: "note_reverted",
    label: "Nota revertida a borrador",
    description: "El autor restaura una versión anterior como nuevo borrador.",
  },
] as const;

export type EmailEventKey = (typeof EMAIL_EVENTS)[number]["key"];

export interface NotificationPreferences {
  emailEnabled: boolean;
  inappEnabled: boolean;
  unsubscribedAt: string | null;
  events: Record<EmailEventKey, boolean>;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  inappEnabled: true,
  unsubscribedAt: null,
  events: {
    email_review_requested: true,
    email_review_approved: true,
    email_review_changes_requested: true,
    email_review_comment: true,
    email_review_cancelled: false,
    email_note_reverted: true,
  },
};

/** Indica si corresponde enviar el email de un evento según las preferencias. */
export function debeEnviarEmail(prefs: NotificationPreferences, key: EmailEventKey): boolean {
  if (!prefs.emailEnabled || prefs.unsubscribedAt) return false;
  return prefs.events[key];
}
