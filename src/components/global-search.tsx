import { Search } from "lucide-react";

/**
 * Búsqueda global — deshabilitada a propósito.
 *
 * Antes llamaba a `busquedaGlobal` (src/lib/search.ts), que leía de los
 * arrays MOCK de `src/lib/clinic-data.ts` (datos ficticios del prototipo,
 * incluida una fecha de referencia hardcodeada). El resto de la app ya
 * corre contra Supabase real; esta búsqueda era la única pantalla que le
 * mostraba a un usuario real pacientes/citas/tratamientos inventados.
 *
 * Veredicto de la auditoría (architecture-3): sacar, no reconstruir ahora.
 * Reactivar solo cuando `busquedaGlobal` tenga una fuente de datos real
 * (query a Supabase por clínica activa).
 */
export function GlobalSearch() {
  return (
    <button
      type="button"
      disabled
      title="Búsqueda global — próximamente"
      aria-disabled="true"
      className="flex h-9 cursor-not-allowed items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs text-muted-foreground opacity-60 sm:w-64"
    >
      <Search className="size-4 shrink-0" />
      <span className="hidden flex-1 text-left sm:inline">Búsqueda global — próximamente</span>
    </button>
  );
}
