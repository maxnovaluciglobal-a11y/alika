import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { DateField, FilterBar, Paginacion, SearchField, SelectField } from "@/components/filters";
import { requirePermission } from "@/lib/route-guards";
import {
  etiquetaEstadoPaciente,
  formatoMoneda,
  getProfesional,
  getSucursal,
  pacientes,
  profesionales,
  sucursales,
  type EstadoPaciente,
} from "@/lib/clinic-data";
import { coincide, num, paginar, str } from "@/lib/search";
import { cn } from "@/lib/utils";

interface PacientesSearch {
  q: string;
  sucursal: string;
  profesional: string;
  estado: string;
  desde: string;
  hasta: string;
  page: number;
}

export const Route = createFileRoute("/_authenticated/_clinic/pacientes/")({
  validateSearch: (search: Record<string, unknown>): PacientesSearch => ({
    q: str(search.q),
    sucursal: str(search.sucursal),
    profesional: str(search.profesional),
    estado: str(search.estado),
    desde: str(search.desde),
    hasta: str(search.hasta),
    page: num(search.page, 1),
  }),
  beforeLoad: requirePermission("patients:view"),
  head: () => ({
    meta: [
      { title: "Pacientes | Oralia" },
      {
        name: "description",
        content:
          "Listado de pacientes con búsqueda global, filtros por sucursal, profesional, estado y rango de fechas, más paginación.",
      },
      { property: "og:title", content: "Pacientes | Oralia" },
      {
        property: "og:description",
        content: "Búsqueda y filtros avanzados de pacientes con saldo, próximo control y riesgo de ausencia.",
      },
    ],
  }),
  component: PacientesPage,
});

const estados: { value: EstadoPaciente; label: string }[] = (
  ["activo", "nuevo", "inactivo"] as EstadoPaciente[]
).map((e) => ({ value: e, label: etiquetaEstadoPaciente[e] }));

function PacientesPage() {
  const { access } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const set = (patch: Partial<PacientesSearch>) =>
    navigate({ search: (prev: PacientesSearch) => ({ ...prev, ...patch, page: patch.page ?? 1 }) });

  const filtrados = useMemo(
    () =>
      pacientes.filter((p) => {
        if (!coincide(search.q, p.nombre, p.documento, p.email, p.telefono, ...p.etiquetas)) return false;
        if (search.sucursal && p.sucursalId !== search.sucursal) return false;
        if (search.profesional && p.profesionalId !== search.profesional) return false;
        if (search.estado && p.estado !== search.estado) return false;
        if (search.desde && p.ultimaVisitaISO < search.desde) return false;
        if (search.hasta && p.ultimaVisitaISO > search.hasta) return false;
        return true;
      }),
    [search],
  );

  const pagina = paginar(filtrados, search.page);
  const activos = [search.q, search.sucursal, search.profesional, search.estado, search.desde, search.hasta].filter(
    Boolean,
  ).length;

  return (
    <AppShell title="Pacientes" access={access}>
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
            placeholder="Nombre, documento, email…"
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
          <DateField label="Última visita desde" value={search.desde} onChange={(desde) => set({ desde })} />
          <DateField label="Última visita hasta" value={search.hasta} onChange={(hasta) => set({ hasta })} />
        </FilterBar>

        <div className="card-clinical overflow-hidden">
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-hairline bg-secondary/40 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Paciente</span>
            <span>Sucursal</span>
            <span>Última visita</span>
            <span>Estado</span>
            <span>Saldo</span>
            <span>Riesgo</span>
          </div>

          <div className="divide-y divide-hairline">
            {pagina.items.map((p) => (
              <Link
                key={p.id}
                to="/pacientes/$pacienteId"
                params={{ pacienteId: p.id }}
                className="grid gap-2 px-5 py-4 transition-colors hover:bg-secondary/50 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] md:items-center md:gap-4"
              >
                <div className="flex items-center gap-3">
                  {p.foto ? (
                    <img
                      src={p.foto}
                      alt={p.nombre}
                      width={512}
                      height={512}
                      loading="lazy"
                      className="size-9 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid size-9 place-items-center rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground">
                      {p.nombre
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.documento} · {getProfesional(p.profesionalId)?.nombre}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{getSucursal(p.sucursalId)?.nombre}</span>
                <span className="text-xs text-muted-foreground">{p.ultimaVisita}</span>
                <span
                  className={cn(
                    "w-fit rounded px-1.5 py-0.5 text-[10px] font-medium",
                    p.estado === "activo"
                      ? "bg-success-soft text-success"
                      : p.estado === "nuevo"
                        ? "bg-ai-soft text-ai"
                        : "bg-secondary text-muted-foreground",
                  )}
                >
                  {etiquetaEstadoPaciente[p.estado]}
                </span>
                <span className={cn("text-xs", p.saldo > 0 ? "font-medium text-warning" : "text-muted-foreground")}>
                  {p.saldo > 0 ? formatoMoneda(p.saldo) : "Al día"}
                </span>
                <span
                  className={cn(
                    "w-fit rounded px-1.5 py-0.5 text-[10px] font-medium",
                    p.riesgoAusencia > 50
                      ? "bg-destructive/10 text-destructive"
                      : p.riesgoAusencia > 25
                        ? "bg-warning-soft text-warning"
                        : "bg-success-soft text-success",
                  )}
                >
                  {p.riesgoAusencia}% ausencia
                </span>
              </Link>
            ))}

            {pagina.items.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                No hay pacientes que coincidan con los filtros aplicados.
              </p>
            )}
          </div>

          <Paginacion pagina={pagina} etiqueta="pacientes" onPage={(page) => navigate({ search: (p: PacientesSearch) => ({ ...p, page }) })} />
        </div>
      </div>
    </AppShell>
  );
}
