import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppShell } from "@/components/app-shell";
import { DateField, FilterBar, Paginacion, SearchField, SelectField } from "@/components/filters";
import { requirePermission } from "@/lib/route-guards";
import { formatoFecha } from "@/lib/clinic-data";
import {
  TREATMENT_PLAN_STATUSES,
  TREATMENT_PLAN_STATUS_LABELS,
  formatMoney,
  type TreatmentPlanStatus,
} from "@/lib/finance";
import { listClinicTreatmentPlans } from "@/lib/finance.functions";
import { coincide, num, paginar, str } from "@/lib/search";
import { cn } from "@/lib/utils";

interface TratamientosSearch {
  q: string;
  estado: string;
  desde: string;
  hasta: string;
  page: number;
}

export const Route = createFileRoute("/_authenticated/_clinic/tratamientos")({
  validateSearch: (search: Record<string, unknown>): TratamientosSearch => ({
    q: str(search.q),
    estado: str(search.estado),
    desde: str(search.desde),
    hasta: str(search.hasta),
    page: num(search.page, 1),
  }),
  beforeLoad: requirePermission("treatments:view"),
  head: () => ({
    meta: [
      { title: "Tratamientos | Alika" },
      {
        name: "description",
        content:
          "Planes de tratamiento con filtros por estado y fecha, avance por sesión y saldo asociado.",
      },
      { property: "og:title", content: "Tratamientos | Alika" },
      {
        property: "og:description",
        content: "Planes de tratamiento filtrables por estado y fecha, con avance por ítems completados.",
      },
    ],
  }),
  component: TratamientosPage,
});

const estados: { value: TreatmentPlanStatus; label: string }[] = TREATMENT_PLAN_STATUSES.map((e) => ({
  value: e,
  label: TREATMENT_PLAN_STATUS_LABELS[e],
}));

const estadoClase: Record<TreatmentPlanStatus, string> = {
  active: "bg-brand-soft text-brand",
  on_hold: "bg-warning-soft text-warning",
  completed: "bg-success-soft text-success",
  cancelled: "bg-secondary text-muted-foreground",
};

function TratamientosPage() {
  const { access } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const clinicId = access.clinic?.id;

  const fetchPlans = useServerFn(listClinicTreatmentPlans);
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["clinic-treatment-plans", clinicId],
    enabled: Boolean(clinicId),
    queryFn: () => fetchPlans({ data: { clinicId: clinicId! } }),
  });

  const set = (patch: Partial<TratamientosSearch>) =>
    navigate({ search: (prev: TratamientosSearch) => ({ ...prev, ...patch, page: patch.page ?? 1 }) });

  const filtrados = useMemo(
    () =>
      plans.filter((t) => {
        if (!coincide(search.q, t.name, t.patientName, t.patientDocument ?? "")) return false;
        if (search.estado && t.status !== search.estado) return false;
        const fecha = (t.startedAt ?? t.createdAt).slice(0, 10);
        if (search.desde && fecha < search.desde) return false;
        if (search.hasta && fecha > search.hasta) return false;
        return true;
      }),
    [plans, search],
  );

  const pagina = paginar(filtrados, search.page);
  const activos = [search.q, search.estado, search.desde, search.hasta].filter(Boolean).length;

  return (
    <AppShell title="Tratamientos" access={access}>
      <div className="space-y-6">
        <FilterBar
          activos={activos}
          onReset={() =>
            navigate({ search: { q: "", estado: "", desde: "", hasta: "", page: 1 } })
          }
        >
          <SearchField
            label="Buscar"
            value={search.q}
            onChange={(q) => set({ q })}
            placeholder="Plan, paciente o documento…"
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
            {isLoading && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Cargando planes…</p>
            )}

            {!isLoading &&
              pagina.items.map((t) => {
                const avance = t.itemsCount > 0 ? Math.round((t.itemsCompleted / t.itemsCount) * 100) : 0;
                const fechaInicio = t.startedAt ?? t.createdAt;
                return (
                  <div
                    key={t.id}
                    className="grid gap-3 px-5 py-4 sm:grid-cols-[1.5fr_2fr_1fr_1fr_1fr] sm:items-center"
                  >
                    <div className="min-w-0">
                      <Link
                        to="/pacientes/$pacienteId"
                        params={{ pacienteId: t.patientId }}
                        className="truncate text-sm font-medium hover:text-brand"
                      >
                        {t.patientName}
                      </Link>
                      {t.patientDocument && (
                        <p className="text-xs text-muted-foreground">{t.patientDocument}</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs text-muted-foreground">
                        {t.name}{" "}
                        <span className="opacity-70">· inicio {formatoFecha(fechaInicio.slice(0, 10))}</span>
                      </p>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${avance}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {avance}% ({t.itemsCompleted}/{t.itemsCount})
                    </span>
                    <span
                      className={cn(
                        "w-fit rounded px-1.5 py-0.5 text-[10px] font-medium",
                        estadoClase[t.status],
                      )}
                    >
                      {TREATMENT_PLAN_STATUS_LABELS[t.status]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatMoney(t.totalCents, t.currency)}
                    </span>
                  </div>
                );
              })}

            {!isLoading && pagina.items.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                No hay planes de tratamiento que coincidan con los filtros.
              </p>
            )}
          </div>

          <Paginacion
            pagina={pagina}
            etiqueta="planes"
            onPage={(page) => navigate({ search: (p: TratamientosSearch) => ({ ...p, page }) })}
          />
        </div>
      </div>
    </AppShell>
  );
}
