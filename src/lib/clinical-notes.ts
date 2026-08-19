export type NoteStatus = "draft" | "signed";

/**
 * Número de versión vigente de una nota a partir de su historial. NO es
 * siempre la de número más alto: un guardado offline en conflicto inserta
 * una versión nueva (regla #9 del repo, nada se pierde) sin actualizar el
 * contenido vigente de la nota — esa fila queda "huérfana" hasta que alguien
 * resuelve el conflicto (o para siempre si lo descarta). La vigente real es
 * la versión cuyo contenido coincide con el de la nota; si ninguna calza
 * (no debería pasar en datos sanos), se cae al número más alto como red de
 * seguridad.
 */
export function versionVigente(
  nota: { title: string; content: string },
  versionesDeLaNota: { version: number; title: string; content: string }[],
): number {
  const vigentes = versionesDeLaNota.filter(
    (v) => v.content === nota.content && v.title === nota.title,
  );
  const candidatas = vigentes.length ? vigentes : versionesDeLaNota;
  return candidatas.reduce((max, v) => Math.max(max, v.version), 0) || 1;
}

export type NoteAiAction = "draft" | "summary" | "polish";

export type NoteReviewStatus = "none" | "pending" | "approved" | "changes_requested";

export type NoteReviewAction =
  "requested" | "approved" | "changes_requested" | "comment" | "cancelled";

export interface ClinicalNote {
  id: string;
  patientRef: string;
  title: string;
  content: string;
  summary: string | null;
  status: NoteStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  reviewStatus: NoteReviewStatus;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewRequestedBy: string | null;
  reviewRequestedByName: string | null;
  reviewRequestedAt: string | null;
  reviewedAt: string | null;
}

export interface ClinicalNoteReview {
  id: string;
  noteId: string;
  action: NoteReviewAction;
  comment: string | null;
  actorId: string;
  actorName: string | null;
  reviewerId: string | null;
  reviewerName: string | null;
  /** Versión de la nota vigente cuando ocurrió la acción. */
  noteVersion: number | null;
  createdAt: string;
}

export const REVIEW_STATUS_LABELS: Record<NoteReviewStatus, string> = {
  none: "Sin revisión",
  pending: "Pendiente de aprobación",
  approved: "Aprobada",
  changes_requested: "Cambios solicitados",
};

export const REVIEW_ACTION_LABELS: Record<NoteReviewAction, string> = {
  requested: "Solicitó revisión",
  approved: "Aprobó la nota",
  changes_requested: "Solicitó cambios",
  comment: "Comentó en la revisión",
  cancelled: "Canceló la solicitud",
};

export interface ClinicalNoteVersion {
  id: string;
  noteId: string;
  version: number;
  title: string;
  content: string;
  summary: string | null;
  aiAssisted: boolean;
  aiAction: string | null;
  authorId: string;
  authorName: string | null;
  createdAt: string;
}

export interface ClinicalNoteAuditEntry {
  id: string;
  noteId: string | null;
  action: string;
  detail: string | null;
  actorId: string;
  actorName: string | null;
  createdAt: string;
}

export type ClinicalEntityKind = "diagnosis" | "treatment" | "medication" | "allergy";

export interface ClinicalNoteEntity {
  id: string;
  noteId: string;
  kind: ClinicalEntityKind;
  term: string;
  code: string | null;
  tooth: string | null;
  quantity: number | null;
  dosage: string | null;
  severity: string | null;
  status: string | null;
  notes: string | null;
  confidence: number | null;
  aiGenerated: boolean;
  confirmed: boolean;
  createdAt: string;
}

export const ENTITY_KIND_LABELS: Record<ClinicalEntityKind, string> = {
  diagnosis: "Diagnósticos",
  treatment: "Tratamientos",
  medication: "Medicamentos",
  allergy: "Alergias",
};

export const ENTITY_KIND_ORDER: ClinicalEntityKind[] = [
  "diagnosis",
  "treatment",
  "medication",
  "allergy",
];

export const AUDIT_LABELS: Record<string, string> = {
  create: "Creó la nota",
  update: "Guardó cambios",
  ai_draft: "Redactó con IA",
  ai_summary: "Resumió con IA",
  ai_polish: "Pulió redacción con IA",
  ai_structure: "Estructuró la nota con IA",
  entity_confirm: "Confirmó un campo estructurado",
  entity_delete: "Eliminó un campo estructurado",
  restore: "Restauró una versión",
  revert: "Revirtió a una versión anterior",

  sign: "Firmó la nota",
  reopen: "Reabrió la nota",
  review_requested: "Solicitó revisión",
  review_approved: "Aprobó la nota en revisión",
  review_changes_requested: "Solicitó cambios en la revisión",
  review_comment: "Comentó en la revisión",
  review_cancelled: "Canceló la solicitud de revisión",
};

export const AI_ACTION_LABELS: Record<string, string> = {
  draft: "Borrador IA",
  summary: "Resumen IA",
  polish: "Redacción IA",
};

export function formatoFechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-419", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
