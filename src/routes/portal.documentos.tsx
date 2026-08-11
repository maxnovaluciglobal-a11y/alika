import { createFileRoute } from "@tanstack/react-router";
import { FileText, Paperclip, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { formatoFecha } from "@/lib/clinic-data";
import { etiquetaEstadoDocumento, tiposDocumento } from "@/lib/portal-data";
import { usePortal } from "@/lib/portal-store";

export const Route = createFileRoute("/portal/documentos")({
  head: () => ({
    meta: [
      { title: "Enviar documentación · Portal Oralia" },
      { name: "description", content: "Envía radiografías, órdenes médicas y credenciales de seguro a tu clínica." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalDocumentos,
});

function formatoTamano(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PortalDocumentos() {
  const { documentos, agregarDocumento } = usePortal();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState(tiposDocumento[0]!);
  const [archivo, setArchivo] = useState<{ nombre: string; tamano: string } | null>(null);
  const [enviado, setEnviado] = useState(false);

  function enviar() {
    if (!archivo) return;
    agregarDocumento({ nombre: archivo.nombre, tipo, tamano: archivo.tamano });
    setArchivo(null);
    if (inputRef.current) inputRef.current.value = "";
    setEnviado(true);
    window.setTimeout(() => setEnviado(false), 3000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Documentación</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envía radiografías, exámenes o tu credencial de seguro antes de la consulta.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
        <label className="block text-sm font-medium" htmlFor="tipo-doc">
          Tipo de documento
        </label>
        <select
          id="tipo-doc"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="w-full rounded-xl border border-border/60 bg-background px-3 py-3 text-sm"
        >
          {tiposDocumento.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground"
        >
          <Upload className="size-5 text-brand" />
          {archivo ? (
            <span className="flex max-w-full items-center gap-1.5 text-foreground">
              <Paperclip className="size-3.5 shrink-0" />
              <span className="truncate">{archivo.nombre}</span>
            </span>
          ) : (
            <span>Toca para elegir un archivo o foto</span>
          )}
          <span className="text-xs">JPG, PNG o PDF · hasta 10 MB</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setArchivo({ nombre: f.name.slice(0, 60), tamano: formatoTamano(f.size) });
          }}
        />

        <button
          type="button"
          disabled={!archivo}
          onClick={enviar}
          className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-medium text-brand-foreground disabled:opacity-40"
        >
          Enviar a la clínica
        </button>
        {enviado && <p className="text-center text-xs text-brand">Documento enviado correctamente.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Enviados</h2>
        {documentos.map((d) => (
          <article
            key={d.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-card p-3"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{d.nombre}</p>
              <p className="truncate text-xs text-muted-foreground">
                {d.tipo} · {d.tamano} · {formatoFecha(d.fecha)}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {etiquetaEstadoDocumento[d.estado]}
            </span>
          </article>
        ))}
        {documentos.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
            Aún no has enviado documentos.
          </p>
        )}
      </section>
    </div>
  );
}
