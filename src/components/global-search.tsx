import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CornerDownLeft, Search, UserRound } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { hasPermission, type ClinicAccess } from "@/lib/access/access";
import { ajustesVisibles, destinosVisibles } from "@/lib/access/navegacion";
import { buscarPacientes } from "@/lib/patients/buscar-pacientes.functions";

/**
 * Búsqueda ⌘K. Reemplaza a la versión deshabilitada que leía los arrays MOCK
 * del prototipo (auditoría architecture-3): ahora solo hay dos fuentes, las
 * dos reales — las páginas que el rol puede abrir y los pacientes de la
 * clínica activa (`buscarPacientes`, con su propio chequeo de permiso).
 */
export function GlobalSearch({ access }: { access: ClinicAccess }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [qDiferida, setQDiferida] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setAbierto((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setQDiferida(q.trim()), 200);
    return () => window.clearTimeout(t);
  }, [q]);

  const paginas = useMemo(() => {
    const desdeDestinos = destinosVisibles(access.role).flatMap((d) =>
      d.pestanas.map((p) => ({
        to: p.to,
        label: p.label === d.label ? d.label : `${d.label} · ${p.label}`,
      })),
    );
    const desdeAjustes = ajustesVisibles(access.role).flatMap((g) =>
      g.items.map((i) => ({ to: i.to, label: `Ajustes · ${i.label}` })),
    );
    const vistas = new Set<string>();
    return [...desdeDestinos, ...desdeAjustes].filter((p) =>
      vistas.has(p.to) ? false : (vistas.add(p.to), true),
    );
  }, [access.role]);

  const termino = q.trim().toLowerCase();
  const paginasFiltradas = termino
    ? paginas.filter((p) => p.label.toLowerCase().includes(termino))
    : paginas.slice(0, 8);

  const clinicId = access.clinic?.id;
  const puedeBuscarPacientes = hasPermission(access.role, "patients:view") && Boolean(clinicId);
  const buscar = useServerFn(buscarPacientes);
  const { data: pacientes = [], isFetching } = useQuery({
    queryKey: ["buscar-pacientes", clinicId, qDiferida],
    enabled: abierto && puedeBuscarPacientes && qDiferida.length >= 2,
    queryFn: () => buscar({ data: { clinicId: clinicId!, q: qDiferida } }),
    staleTime: 30_000,
  });

  function ir(to: string) {
    setAbierto(false);
    setQ("");
    void navigate({ to });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Buscar paciente o página"
        className="flex h-9 w-9 items-center justify-center gap-2 rounded-md border border-border text-sm text-muted-foreground transition-colors hover:border-brand/60 hover:text-foreground sm:w-full sm:justify-start sm:px-3"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="hidden flex-1 truncate text-left sm:inline">Buscar paciente…</span>
        <kbd className="hidden rounded-sm border border-border px-1.5 text-[11px] sm:inline">
          ⌘K
        </kbd>
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="overflow-hidden p-0">
          <DialogTitle className="sr-only">Buscar en Alika</DialogTitle>
          <Command
            shouldFilter={false}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5"
          >
            <CommandInput
              value={q}
              onValueChange={setQ}
              placeholder={
                puedeBuscarPacientes
                  ? "Paciente, documento, teléfono o página…"
                  : "Ir a una página…"
              }
            />
            <CommandList>
              <CommandEmpty>
                {isFetching ? "Buscando…" : "Sin resultados para esa búsqueda."}
              </CommandEmpty>
              {pacientes.length > 0 && (
                <CommandGroup heading="Pacientes">
                  {pacientes.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`paciente-${p.id}`}
                      onSelect={() => ir(`/pacientes/${p.id}`)}
                    >
                      <UserRound className="text-muted-foreground" aria-hidden />
                      <span className="flex-1 truncate">{p.nombre}</span>
                      <span className="truncate text-xs text-muted-foreground tabular-nums">
                        {p.documento ?? p.telefono ?? ""}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {paginasFiltradas.length > 0 && (
                <CommandGroup heading="Ir a">
                  {paginasFiltradas.map((p) => (
                    <CommandItem key={p.to} value={`pagina-${p.to}`} onSelect={() => ir(p.to)}>
                      <CornerDownLeft className="text-muted-foreground" aria-hidden />
                      {p.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
