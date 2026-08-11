import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CalendarDays, Search, Stethoscope, User } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { HOY } from "@/lib/clinic-data";
import { busquedaGlobal, type GrupoResultado } from "@/lib/search";

const iconos: Record<GrupoResultado, typeof User> = {
  Pacientes: User,
  Citas: CalendarDays,
  Tratamientos: Stethoscope,
};

const grupos: GrupoResultado[] = ["Pacientes", "Citas", "Tratamientos"];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const resultados = useMemo(() => busquedaGlobal(term), [term]);

  function abrir(destino: string, pacienteId: string, titulo: string) {
    setOpen(false);
    setTerm("");
    if (destino === "pacientes") {
      navigate({ to: "/pacientes/$pacienteId", params: { pacienteId } });
    } else if (destino === "agenda") {
      navigate({ to: "/agenda", search: { q: titulo.split(" — ").pop() ?? "", fecha: HOY, sucursal: "", profesional: "", estado: "", page: 1 } });
    } else {
      navigate({ to: "/tratamientos", search: { q: titulo, sucursal: "", profesional: "", estado: "", desde: "", hasta: "", page: 1 } });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:w-64"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden flex-1 text-left sm:inline">Buscar en la clínica…</span>
        <kbd className="hidden rounded border border-border px-1 py-0.5 font-mono text-[10px] sm:inline">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          value={term}
          onValueChange={setTerm}
          placeholder="Pacientes, citas, tratamientos, profesionales…"
        />
        <CommandList>
          <CommandEmpty>
            {term.trim() ? `Sin resultados para “${term}”.` : "Escribe para buscar en toda la clínica."}
          </CommandEmpty>
          {grupos.map((grupo) => {
            const items = resultados.filter((r) => r.grupo === grupo);
            if (items.length === 0) return null;
            const Icon = iconos[grupo];
            return (
              <CommandGroup key={grupo} heading={grupo}>
                {items.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={`${r.titulo} ${r.detalle}`}
                    onSelect={() => abrir(r.destino, r.pacienteId, r.titulo)}
                  >
                    <Icon className="mr-2 size-4 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{r.titulo}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.detalle}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
