import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Clock, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DateField, FilterBar, Paginacion, SearchField, SelectField } from "@/components/filters";
import { requirePermission } from "@/lib/route-guards";
import { AgendaGrid } from "@/components/agenda-grid";
import {
  citas,
  etiquetaEstado,
  formatoFechaLarga,
  getProfesional,
  getSucursal,
  HORA_INICIO,
  HOY,
  listaEspera,
  profesionales,
  sucursales,
  type EstadoCita,
} from "@/lib/clinic-data";
import { coincide, num, paginar, str } from "@/lib/search";
import { cn } from "@/lib/utils";

interface AgendaSearch {
  q: string;
  fecha: string;
  sucursal: string;
  profesional: string;
  estado: string;
  page: number;
}

export const Route = createFileRoute("/_authenticated/_clinic/agenda")({
  validateSearch: (search: Record<string, unknown>): AgendaSearch => ({
    q: str(search.q),
    fecha: str(search.fecha, HOY),
    sucursal: str(search.sucursal),
    profesional: str(search.profesional),
    estado: str(search.estado),
    page: num(search.page, 1),
  }),
  beforeLoad: requirePermission("agenda:view"),
  head: () => ({
    meta: [
      { title: "Agenda inteligente | Oralia" },
      {
        name: "description",
        content:
          "Agenda por fecha, profesional, sucursal y estado, con lista de espera inteligente y predicción de ausencias.",
      },
      { property: "og:title", content: "Agenda inteligente | Oralia" },
      {
        property: "og:description",
        content: "Agenda filtrable por fecha, profesional, sucursal y estado, con lista de espera inteligente.",
      },
    ],
  }),
  component: AgendaPage,
});

const estados: { value: EstadoCita; label: string }[] = (
  ["confirmada", "en-sala", "ausente", "finalizada", "tentativa"] as EstadoCita[]
).map((e) => ({ value: e, label: etiquetaEstado[e] }));

function horaDeCita(minutos: number) {
  const total = HORA_INICIO * 60 + minutos;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function AgendaPage() {
  const { access } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const set = (patch: Partial<AgendaSearch>) =>
    navigate({ search: (prev: AgendaSearch) => ({ ...prev, ...patch, page: patch.page ?? 1 }) });

  const filtradas = useMemo(
    () =>
      citas.filter((c) => {
        if (!coincide(search.q, c.paciente, c.tratamiento, getProfesional(c.profesionalId)?.nombre)) return false;
        if (search.fecha && c.fecha !== search.fecha) return false;
        if (search.sucursal && c.sucursalId !== search.sucursal) return false;
        if (search.profesional && c.profesionalId !== search.profesional) return false;
        if (search.estado && c.estado !== search.estado) return false;
        return true;
      }),
    [search],
  );

  const columnas = useMemo(
    () =>
      profesionales.filter((p) => {
        if (search.sucursal && p.sucursalId !== search.sucursal) return false;
        if (search.profesional && p.id !== search.profesional) return false;
        return true;
      }),
    [search.sucursal, search.profesional],
  );

  const ordenadas = useMemo(
    () => [...filtradas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicio - b.inicio),
    [filtradas],
  );
  const pagina = paginar(ordenadas, search.page);
  const activos = [search.q, search.sucursal, search.profesional, search.estado].filter(Boolean).length +
    (search.fecha !== HOY ? 1 : 0);

  return (
    <AppShell title="Agenda" access={access}>
      <div className="space-y-6">
        <FilterBar
          activos={activos}
          onReset={() =>
            navigate({ search: { q: "", fecha: HOY, sucursal: "", profesional: "", estado: "", page: 1 } })
          }
        >
          <SearchField
            label="Buscar"
            value={search.q}
            onChange={(q) => set({ q })}
            placeholder="Paciente, tratamiento…"
          />
          <DateField label="Fecha" value={search.fecha} onChange={(fecha) => set({ fecha })} />
          <SelectField
            label="Sucursal"
            value={search.sucursal}
            onChange={(sucursal) => set({ sucursal, profesional: "" })}
            allLabel="Todas las sucursales"
            options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
          />
          <SelectField
            label="Profesional"
            value={search.profesional}
            onChange={(profesional) => set({ profesional })}
            allLabel="Todos los profesionales"
            options={profesionales
              .filter((p) => !search.sucursal || p.sucursalId === search.sucursal)
              .map((p) => ({ value: p.id, label: `${p.nombre} · ${p.box}` }))}
          />
          <SelectField
            label="Estado"
            value={search.estado}
            onChange={(estado) => set({ estado })}
            allLabel="Todos los estados"
            options={estados}
          />
        </FilterBar>

        <div className="grid gap-8 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-9">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold capitalize">
                {search.fecha ? formatoFechaLarga(search.fecha) : "Todas las fechas"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {filtradas.length} cita{filtradas.length === 1 ? "" : "s"} en la vista
              </p>
            </div>

            <AgendaGrid citas={filtradas} profesionales={columnas} />

            <div className="card-clinical overflow-hidden">
              <div className="border-b border-hairline bg-secondary/40 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Listado de citas filtradas
              </div>
              <div className="divide-y divide-hairline">
                {pagina.items.map((c) => (
                  <Link
                    key={c.id}
                    to="/pacientes/$pacienteId"
                    params={{ pacienteId: c.pacienteId }}
                    className="grid gap-2 px-5 py-3 transition-colors hover:bg-secondary/50 sm:grid-cols-[auto_2fr_1.5fr_1fr_auto] sm:items-center sm:gap-4"
                  >
                    <span className="font-mono text-xs text-muted-foreground">{horaDeCita(c.inicio)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.paciente}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.tratamiento}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {getProfesional(c.profesionalId)?.nombre} · {getSucursal(c.sucursalId)?.nombre}
                    </span>
                    <span className="text-xs text-muted-foreground">{c.duracion} min</span>
                    <span
                      className={cn(
                        "w-fit rounded px-1.5 py-0.5 text-[10px] font-medium",
                        c.estado === "ausente"
                          ? "bg-destructive/10 text-destructive"
                          : c.estado === "en-sala"
                            ? "bg-warning-soft text-warning"
                            : c.estado === "tentativa"
                              ? "bg-ai-soft text-ai"
                              : c.estado === "finalizada"
                                ? "bg-secondary text-muted-foreground"
                                : "bg-brand-soft text-brand",
                      )}
                    >
                      {etiquetaEstado[c.estado]}
                    </span>
                  </Link>
                ))}
                {pagina.items.length === 0 && (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No hay citas que coincidan con los filtros aplicados.
                  </p>
                )}
              </div>
              <Paginacion
                pagina={pagina}
                etiqueta="citas"
                onPage={(page) => navigate({ search: (p: AgendaSearch) => ({ ...p, page }) })}
              />
            </div>
          </div>

          <aside className="space-y-4 xl:col-span-3">
            <h2 className="font-display text-xl font-semibold text-muted-foreground">Lista de espera</h2>
            <div className="card-clinical divide-y divide-hairline">
              {listaEspera.map((e) => (
                <div key={e.id} className="flex items-start gap-3 p-4">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-warning" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{e.nombre}</p>
                    <p className="text-xs text-muted-foreground">{e.motivo}</p>
                    {e.espera !== "—" && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="size-3" /> {e.espera} de espera
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-ai/15 bg-ai-soft p-5">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ai">
                <Sparkles className="size-3" /> Optimización IA
              </p>
              <p className="text-xs text-muted-foreground">
                Roberto Gómez tiene 71% de probabilidad de ausencia en horario matinal. Sugerido moverlo a las 16:30 y
                ofrecer su bloque a Elena Paz.
              </p>
              <button className="mt-3 w-full rounded-lg bg-ai py-2 text-xs font-medium text-ai-foreground transition-opacity hover:opacity-90">
                Aplicar sugerencia
              </button>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
