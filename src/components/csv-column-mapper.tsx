// src/components/csv-column-mapper.tsx
//
// Paso de mapeo manual "tu columna X → mi campo Y" — ver
// src/lib/csv/column-mapping.ts para el porqué. Solo se muestra cuando el
// auto-detect de alias no alcanzó para algún campo obligatorio.

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CsvFieldSpec } from "@/lib/csv/column-mapping";

const SIN_COLUMNA = "__sin_columna__";

export function CsvColumnMapper({
  fields,
  headers,
  sampleRow,
  mapping,
  onChange,
}: {
  fields: CsvFieldSpec[];
  headers: string[];
  /** Primera fila del CSV, para mostrar un ejemplo real del valor elegido. */
  sampleRow: Record<string, string> | undefined;
  mapping: Record<string, string | null>;
  onChange: (fieldKey: string, header: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        No reconocimos automáticamente todas las columnas. Elegí qué columna de tu archivo
        corresponde a cada campo.
      </p>
      <div className="space-y-2">
        {fields.map((field) => {
          const seleccionada = mapping[field.key];
          return (
            <div key={field.key} className="flex items-center gap-2">
              <div className="w-32 shrink-0 text-xs">
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </div>
              <Select
                value={seleccionada ?? SIN_COLUMNA}
                onValueChange={(v) => onChange(field.key, v === SIN_COLUMNA ? null : v)}
              >
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue placeholder="Elegir columna…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_COLUMNA}>
                    {field.required ? "— sin columna —" : "— ninguna (opcional) —"}
                  </SelectItem>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {seleccionada && sampleRow?.[seleccionada] && (
                <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                  ej: {sampleRow[seleccionada]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
