import { CalendarDays } from "lucide-react";

/** Aviso inline cuando la fecha elegida en un selector de turno cae en feriado (Nager.Date). */
export function HolidayNotice({ name }: { name: string }) {
  return (
    <p className="flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
      <CalendarDays className="size-3.5 shrink-0" />
      Ese día es feriado ({name}) — la clínica podría estar cerrada.
    </p>
  );
}
