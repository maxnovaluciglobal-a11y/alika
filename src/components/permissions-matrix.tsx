import { useState } from "react";
import { Check, CircleSlash, Minus } from "lucide-react";

import {
  CLINIC_ROLES,
  PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  hasPermission,
  type Permission,
} from "@/lib/access";
import {
  NOTE_ACTIONS,
  NOTE_ACTION_LABELS,
  NOTE_STATES,
  NOTE_STATE_LABELS,
  evaluarAccionNota,
  type NoteState,
} from "@/lib/note-permissions";

const PERMISSION_LABELS: Record<Permission, string> = {
  "dashboard:view": "Ver dashboard",
  "agenda:view": "Ver agenda",
  "agenda:manage": "Gestionar agenda",
  "patients:view": "Ver pacientes",
  "patients:manage": "Gestionar pacientes",
  "clinical:view": "Ver historia clínica",
  "clinical:write": "Escribir historia clínica",
  "treatments:view": "Ver tratamientos",
  "team:view": "Ver equipo",
  "team:manage": "Gestionar equipo",
  "settings:manage": "Configuración de la clínica",
};

function Marca({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-primary">
      <Check className="size-4" aria-hidden />
      <span className="sr-only">Permitido</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground/50">
      <Minus className="size-4" aria-hidden />
      <span className="sr-only">No permitido</span>
    </span>
  );
}

const ESTILO_VEREDICTO = {
  allow: "bg-primary/10 text-primary",
  conditional: "bg-accent text-accent-foreground",
  deny: "bg-muted text-muted-foreground",
} as const;

const TEXTO_VEREDICTO = {
  allow: "Sí",
  conditional: "Condicional",
  deny: "No",
} as const;

/** Matriz de permisos por rol (módulos) y por estado de la nota clínica. */
export function PermissionsMatrix() {
  const [estado, setEstado] = useState<NoteState>("draft");

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Acceso por módulo</h2>
          <p className="text-sm text-muted-foreground">
            Qué secciones de Oralia puede abrir cada rol. Las reglas se aplican también en el servidor.
          </p>
        </div>

        <div className="card-clinical overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <caption className="sr-only">Permisos de módulos por rol de clínica</caption>
            <thead>
              <tr className="border-b border-hairline">
                <th scope="col" className="px-5 py-3 text-left font-medium text-muted-foreground">
                  Permiso
                </th>
                {CLINIC_ROLES.map((rol) => (
                  <th
                    key={rol}
                    scope="col"
                    className="px-3 py-3 text-center font-medium"
                    title={ROLE_DESCRIPTIONS[rol]}
                  >
                    {ROLE_LABELS[rol]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((permiso) => (
                <tr key={permiso} className="border-b border-hairline last:border-0">
                  <th scope="row" className="px-5 py-3 text-left font-normal">
                    {PERMISSION_LABELS[permiso]}
                    <span className="ml-2 text-[10px] text-muted-foreground">{permiso}</span>
                  </th>
                  {CLINIC_ROLES.map((rol) => (
                    <td key={rol} className="px-3 py-3 text-center">
                      <Marca ok={hasPermission(rol, permiso)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Notas clínicas por estado</h2>
          <p className="text-sm text-muted-foreground">
            Reglas que aplica la base de datos según el estado de la nota. “Condicional” significa que
            depende de la relación con la nota (autor, revisor o solicitante).
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Estado de la nota">
          {NOTE_STATES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={estado === s}
              onClick={() => setEstado(s)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                estado === s
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {NOTE_STATE_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="card-clinical overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <caption className="sr-only">
              Acciones permitidas sobre una nota en estado {NOTE_STATE_LABELS[estado]}
            </caption>
            <thead>
              <tr className="border-b border-hairline">
                <th scope="col" className="px-5 py-3 text-left font-medium text-muted-foreground">
                  Acción
                </th>
                {CLINIC_ROLES.map((rol) => (
                  <th key={rol} scope="col" className="px-3 py-3 text-center font-medium">
                    {ROLE_LABELS[rol]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NOTE_ACTIONS.map((accion) => (
                <tr key={accion} className="border-b border-hairline last:border-0">
                  <th scope="row" className="px-5 py-3 text-left font-normal">
                    {NOTE_ACTION_LABELS[accion]}
                  </th>
                  {CLINIC_ROLES.map((rol) => {
                    const r = evaluarAccionNota(rol, estado, accion);
                    return (
                      <td key={rol} className="px-3 py-3 text-center">
                        <span
                          title={r.detalle}
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${ESTILO_VEREDICTO[r.verdict]}`}
                        >
                          {TEXTO_VEREDICTO[r.verdict]}
                        </span>
                        <span className="sr-only">{r.detalle}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <CircleSlash className="size-3.5" aria-hidden />
          Estas reglas se validan con triggers en la base de datos: aunque la interfaz muestre un botón,
          el servidor rechaza cualquier acción fuera de la matriz.
        </p>
      </section>
    </div>
  );
}
