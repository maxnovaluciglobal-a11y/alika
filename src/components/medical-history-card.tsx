import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";

import { getMedicalHistory, setMedicalHistory } from "@/lib/medical-history.functions";

function ChipListEditor({
  label,
  placeholder,
  items,
  onChange,
  disabled,
  tone,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
  tone?: "destructive";
}) {
  const [draft, setDraft] = useState("");

  function agregar() {
    const value = draft.trim();
    if (!value || items.includes(value)) return;
    onChange([...items, value]);
    setDraft("");
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && (
          <span className="text-xs text-muted-foreground">Sin registrar.</span>
        )}
        {items.map((item) => (
          <span
            key={item}
            className={
              tone === "destructive"
                ? "flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive"
                : "flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs"
            }
          >
            {item}
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(items.filter((i) => i !== item))}
                className="opacity-60 hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregar();
              }
            }}
            placeholder={placeholder}
            className="w-full max-w-xs rounded-lg border border-hairline bg-transparent px-3 py-1.5 text-xs outline-none focus:border-brand/50"
          />
          <button
            type="button"
            onClick={agregar}
            disabled={!draft.trim()}
            className="rounded-lg border border-hairline px-2.5 text-xs text-muted-foreground hover:bg-secondary disabled:opacity-40"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function MedicalHistoryCard({
  clinicId,
  patientId,
  puedeEditar,
}: {
  clinicId: string;
  patientId: string;
  puedeEditar: boolean;
}) {
  const fetchFn = useServerFn(getMedicalHistory);
  const historyQuery = useQuery({
    queryKey: ["medical-history", clinicId, patientId],
    queryFn: () => fetchFn({ data: { clinicId, patientId } }),
  });

  const [allergies, setAllergies] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!historyQuery.data) return;
    setAllergies(historyQuery.data.allergies);
    setMedications(historyQuery.data.chronicMedications);
    setConditions(historyQuery.data.conditions);
    setNotes(historyQuery.data.notes ?? "");
  }, [historyQuery.data]);

  const queryClient = useQueryClient();
  const saveFn = useServerFn(setMedicalHistory);
  const guardar = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          clinicId,
          patientId,
          allergies,
          chronicMedications: medications,
          conditions,
          notes,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medical-history", clinicId, patientId] });
      toast.success("Antecedentes médicos guardados.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty =
    historyQuery.data &&
    (JSON.stringify(allergies) !== JSON.stringify(historyQuery.data.allergies) ||
      JSON.stringify(medications) !== JSON.stringify(historyQuery.data.chronicMedications) ||
      JSON.stringify(conditions) !== JSON.stringify(historyQuery.data.conditions) ||
      notes !== (historyQuery.data.notes ?? ""));

  return (
    <section className="card-clinical p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-semibold">Anamnesis</h3>
        {puedeEditar && dirty && (
          <button
            type="button"
            onClick={() => guardar.mutate()}
            disabled={guardar.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground hover:opacity-90 disabled:opacity-60"
          >
            {guardar.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Guardar
          </button>
        )}
      </div>

      {historyQuery.isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando antecedentes…
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <ChipListEditor
            label="Alergias"
            placeholder="Ej. Penicilina"
            items={allergies}
            onChange={setAllergies}
            disabled={!puedeEditar}
            tone="destructive"
          />
          <ChipListEditor
            label="Medicación crónica"
            placeholder="Ej. Losartán 50mg"
            items={medications}
            onChange={setMedications}
            disabled={!puedeEditar}
          />
          <ChipListEditor
            label="Antecedentes / patologías"
            placeholder="Ej. Diabetes tipo 2"
            items={conditions}
            onChange={setConditions}
            disabled={!puedeEditar}
          />
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Notas adicionales</p>
            {puedeEditar ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Ej. embarazo, precauciones al anestesiar…"
                className="w-full rounded-lg border border-hairline bg-transparent px-3 py-2 text-xs outline-none focus:border-brand/50"
              />
            ) : (
              <p className="text-xs text-muted-foreground">{notes || "Sin notas."}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Banner compacto para el header de la ficha — solo se muestra si hay
 * alergias cargadas. Separado del resto de la anamnesis a propósito: es lo
 * único que el staff necesita ver de un vistazo antes de tratar al
 * paciente, no algo que deba ir a buscar dentro de una sección. */
export function AllergyAlertBanner({ allergies }: { allergies: string[] }) {
  if (allergies.length === 0) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
      <AlertTriangle className="size-3.5 shrink-0" />
      Alergias: {allergies.join(", ")}
    </div>
  );
}
