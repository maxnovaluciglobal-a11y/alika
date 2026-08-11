import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { DateField, FilterBar, Paginacion, SearchField, SelectField } from "@/components/filters";
import { requirePermission } from "@/lib/route-guards";
import {
  etiquetaEstadoTratamiento,
  formatoFecha,
  formatoMoneda,
  getPaciente,
  getProfesional,
  getSucursal,
  profesionales,
  sucursales,
  tratamientos,
  type EstadoTratamiento,
} from "@/lib/clinic-data";
import { coincide, num, paginar, str } from "@/lib/search";
import { cn } from "@/lib/utils";

interface TratamientosSearch {
  q: string;
  sucursal: string;
  profesional: string;
  estado: string;
  desde: string;
  hasta: string;
  page: number;
}

export const Route = createFileRoute("/_authenticated/_clinic/tratamientos")({
  validateSearch: (search: Record<string, unknown>): TratamientosSearch => ({
    q: str(search.q),
    sucursal: str(search.sucursal),
    profesional: str(search.profesional),
    estado: str(search.estado),
    desde: str(search.desde),
    hasta: str(search.hasta),
    page: num(search.page, 1),
  }),
  beforeLoad: requirePermission("treatments:view"),
  head: () => ({
    meta: [
      { title: "Tratamientos | Oralia" },
      {
        name: "description",
        content:
          "Planes de tratamiento con filtros por sucursal, profesional, estado y fecha de inicio, avance por sesión y saldo asociado.",
      },
      { property: "og:title", content: "Tratamientos | Oralia" },
      {
        property: "og:description",
        content: "Planes de tratamiento filtrables por estado, profesional y sucursal, con avance y saldo.",
      },
    ],
  }),
  component: TratamientosPage,
});

const estados: { value: EstadoTratamiento; label: string }[] = (
  ["presupuestado", "en-curso", "pausado", "finalizado"] as EstadoTratamiento[]
).map((e) => ({ value: e, label: etiquetaEstadoTratamiento[e] }));

const estadoClase: Record<EstadoTratamiento, string> = {
  presupuestado: "bg-ai-soft text-ai",
  "en-curso": "bg-brand-soft text-brand",
  pausado: "bg-warning-soft text-warning",
  finalizado: "bg-success-soft text-success",
};

function TratamientosPage() {
  const { access } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const set = (patch: Partial<TratamientosSearch>) =>
    navigate({ search: (prev: TratamientosSearch) => ({ ...prev, ...patch, page: patch.page ?? 1 }) });

  const filtrados = useMemo(
    () =>
      tratamientos.filter((t) => {
        const paciente = getPaciente(t.pacienteId);
        if (!coincide(search.q, t.plan, paciente?.nombre, paciente?.documento, getProfesional(t.profesionalId)?.nombre))
          return false;
        if (search.sucursal && t.sucursalId !== search.sucursal) return false;
        if (search.profesional && t.profesionalId !== search.profesional) return false;
        if (search.estado && t.estado !== search.estado) return false;
        if (search.desde && t.fecha < search.desde) return false;
        if (search.hasta && t.fecha > search.hasta) return false;
        return true;
      }),
    [search],
  );

  const pagina = paginar(filtrados, search.page);
  const activos = [search.q, search.sucursal, search.profesional, search.estado, search.desde, search.hasta].filter(
    Boolean,
  ).length;

  return (
    <AppShell title="Tratamientos" access={access}>
      <div className="space-y-6">
        <FilterBar
          activos={activos}
          onReset={() =>
            navigate({ search: { q: "", sucursal: "", profesional: "", estado: "", desde: "", hasta: "", page: 1 } })
          }
        >
          <SearchField
            label="Buscar"
            value={search.q}
            onChange={(q) => set({ q })}
            placeholder="Plan, paciente o profesional…"
          />
          <SelectField
            label="Sucursal"
            value={search.sucursal}
            onChange={(sucursal) => set({ sucursal })}
            allLabel="Todas las sucursales"
            options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))}
          />
          <SelectField
            label="Profesional"
            value={search.profesional}
            onChange={(profesional) => set({ profesional })}
            allLabel="Todos los profesionales"
            options={profesionales.map((p) => ({ value: p.id, label: p.nombre }))}
          />
          <SelectField
            label="Estado"
            value={search.estado}
            onChange={(estado) => set({ estado })}
            allLabel="Todos los estados"
            options={estados}
          />
          <DateField label="Inicio desde" value={search.desde} onChange={(desde) => set({ desde })} />
          <DateField label="Inicio hasta" value={search.hasta} onChange={(hasta) => set({ hasta })} />
        </FilterBar>

        <div className="card-clinical overflow-hidden">
          <div className="divide-y divide-hairline">
            {pagina.items.map((t) => {
              const p = getPaciente(t.pacienteId);
              return (
                <div
                  key={t.id}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[1.5fr_2fr_1fr_1fr_1fr] sm:items-center"
                >
                  <div className="min-w-0">
                    {p ? (
                      <Link
                        to="/pacientes/$pacienteId"
                        params={{ pacienteId: p.id }}
                        className="truncate text-sm font-medium hover:text-brand"
                      >
                        {p.nombre}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium">Paciente</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {getProfesional(t.profesionalId)?.nombre} · {getSucursal(t.sucursalId)?.nombre}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs text-muted-foreground">
                      {t.plan} <span className="opacity-70">· inicio {formatoFecha(t.fecha)}</span>
                    </p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${t.avance}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{t.avance}% completado</span>
                  <span className={cn("w-fit rounded px-1.5 py-0.5 text-[10px] font-medium", estadoClase[t.estado])}>
                    {etiquetaEstadoTratamiento[t.estado]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p && p.saldo > 0 ? formatoMoneda(p.saldo) : "Sin saldo"}
                  </span>
                </div>
              );
            })}

            {pagina.items.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                No hay tratamientos que coincidan con los filtros aplicados.
              </p>
            )}
          </div>

          <Paginacion
            pagina={pagina}
            etiqueta="tratamientos"
            onPage={(page) => navigate({ search: (p: TratamientosSearch) => ({ ...p, page }) })}
          />
        </div>
      </div>
    </AppShell>
  );
}
