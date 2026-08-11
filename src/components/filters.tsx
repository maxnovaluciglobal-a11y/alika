import { Search, SlidersHorizontal, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Pagina } from "@/lib/search";

export function FilterBar({
  children,
  onReset,
  activos,
}: {
  children: React.ReactNode;
  onReset: () => void;
  activos: number;
}) {
  return (
    <div className="card-clinical p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <SlidersHorizontal className="size-3.5" /> Filtros avanzados
          {activos > 0 && (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">
              {activos} activo{activos > 1 ? "s" : ""}
            </span>
          )}
        </p>
        {activos > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-3" /> Limpiar
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </div>
  );
}

const fieldClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function SearchField({
  value,
  onChange,
  label,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className={cn(fieldClass, "pl-9")}
        />
      </span>
    </label>
  );
}

export function SelectField({
  value,
  onChange,
  label,
  options,
  allLabel = "Todos",
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={cn(fieldClass, "appearance-none bg-[length:0] pr-8")}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DateField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={fieldClass}
      />
    </label>
  );
}

export function Paginacion<T>({
  pagina,
  onPage,
  etiqueta,
}: {
  pagina: Pagina<T>;
  onPage: (p: number) => void;
  etiqueta: string;
}) {
  const { page, totalPages, total, desde, hasta } = pagina;
  const paginas = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav
      aria-label={`Paginación de ${etiqueta}`}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-3"
    >
      <p className="text-xs text-muted-foreground">
        {total === 0 ? `Sin ${etiqueta}` : `Mostrando ${desde}–${hasta} de ${total} ${etiqueta}`}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40"
        >
          Anterior
        </button>
        {paginas.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "min-w-8 rounded-md px-2 py-1 text-xs transition-colors",
              p === page ? "bg-brand font-medium text-brand-foreground" : "text-muted-foreground hover:bg-secondary",
            )}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </nav>
  );
}
