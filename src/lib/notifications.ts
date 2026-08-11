export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  noteId: string | null;
  patientRef: string | null;
  readAt: string | null;
  createdAt: string;
}

export const NOTIFICATION_KIND_LABELS: Record<string, string> = {
  review_requested: "Revisión solicitada",
  review_approved: "Nota aprobada",
  review_changes_requested: "Cambios solicitados",
  review_comment: "Nuevo comentario",
  review_cancelled: "Revisión cancelada",
};

/** Formatea la antigüedad de una notificación en lenguaje natural. */
export function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  return `hace ${dias} d`;
}
