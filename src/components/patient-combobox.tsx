import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

/**
 * Reemplaza el `<select>` nativo de elegir paciente — inusable en una
 * clínica con cientos de pacientes, hay que scrollear la lista entera a
 * ciegas en vez de escribir el nombre (auditoría UX, 30-ago).
 */
export function PatientCombobox({
  id,
  value,
  onChange,
  pacientes,
  placeholder = "Elegir paciente…",
}: {
  id?: string;
  value: string;
  onChange: (patientId: string) => void;
  pacientes: { id: string; nombre: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  // rendimiento 01-sep: antes .find() en cada render + de nuevo dentro del
  // `filter` de cmdk en cada tecla tipeada (O(n²) total con cientos de
  // pacientes, el motivo por el que este combobox existe). Memoizado + el
  // filtro custom se saca (ver value={p.nombre} abajo, cmdk ya filtra por
  // substring sobre ese value nativo, sin re-buscar por id en cada llamada).
  const seleccionado = useMemo(() => pacientes.find((p) => p.id === value), [pacientes, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border border-hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/50",
            !seleccionado && "text-muted-foreground",
          )}
        >
          <span className="truncate">{seleccionado?.nombre ?? placeholder}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar paciente…" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {pacientes.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.nombre}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", p.id === value ? "opacity-100" : "opacity-0")} />
                  {p.nombre}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
