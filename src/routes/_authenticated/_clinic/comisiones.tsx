import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Percent } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DateField, FilterBar } from "@/components/filters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePermission } from "@/lib/route-guards";
import { hoyISO } from "@/lib/clinic-data";
import { formatMoney } from "@/lib/finance";
import { getCommissionReport } from "@/lib/commissions.functions";
import { str } from "@/lib/search";

interface ComisionesSearch {
  desde: string;
  hasta: string;
}

function primerDiaDelMes(): string {
  const hoy = hoyISO();
  return `${hoy.slice(0, 7)}-01`;
}

export const Route = createFileRoute("/_authenticated/_clinic/comisiones")({
  validateSearch: (search: Record<string, unknown>): ComisionesSearch => ({
    desde: str(search.desde, primerDiaDelMes()),
    hasta: str(search.hasta, hoyISO()),
  }),
  beforeLoad: requirePermission("finance:view"),
  head: () => ({
    meta: [
      { title: "Comisiones | Alika" },
      {
        name: "description",
        content:
          "Liquidación de comisiones por profesional según producción realizada en el período.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ComisionesPage,
});

function ComisionesPage() {
  const { access } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const clinicId = access.clinic?.id;
  const currency = access.clinic?.currency ?? "CLP";

  const fetchReport = useServerFn(getCommissionReport);
  const { data: lineas, isLoading } = useQuery({
    queryKey: ["commission-report", clinicId, search.desde, search.hasta],
    enabled: Boolean(clinicId),
    queryFn: () =>
      fetchReport({ data: { clinicId: clinicId!, from: search.desde, to: search.hasta } }),
  });

  const set = (patch: Partial<ComisionesSearch>) =>
    navigate({ search: (prev: ComisionesSearch) => ({ ...prev, ...patch }) });

  const totalComision = (lineas ?? []).reduce((acc, l) => acc + (l.commissionCents ?? 0), 0);
  const totalProduccion = (lineas ?? []).reduce((acc, l) => acc + l.productionCents, 0);
  const sinRegla = (lineas ?? []).filter((l) => l.commissionCents === null).length;

  return (
    <AppShell title="Comisiones" access={access}>
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold">Liquidación de comisiones</h2>
          <p className="text-sm text-muted-foreground">
            Según los procedimientos completados en el período. La comisión se calcula con la regla
            vigente de cada profesional (se edita en Profesionales).
          </p>
        </div>

        <FilterBar activos={0} onReset={() => set({ desde: primerDiaDelMes(), hasta: hoyISO() })}>
          <DateField label="Desde" value={search.desde} onChange={(desde) => set({ desde })} />
          <DateField label="Hasta" value={search.hasta} onChange={(hasta) => set({ hasta })} />
        </FilterBar>

        {isLoading && (
          <p className="px-1 py-10 text-center text-sm text-muted-foreground">Cargando…</p>
        )}

        {!isLoading && lineas && (
          <>
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="card-clinical p-5">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Percent className="size-3.5" /> Comisión total del período
                </p>
                <p className="font-display text-2xl font-semibold">
                  {formatMoney(totalComision, currency)}
                </p>
              </div>
              <div className="card-clinical p-5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Producción total
                </p>
                <p className="font-display text-2xl font-semibold">
                  {formatMoney(totalProduccion, currency)}
                </p>
              </div>
            </section>

            {sinRegla > 0 && (
              <p className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-2.5 text-xs text-warning">
                {sinRegla} profesional{sinRegla === 1 ? "" : "es"} sin regla de comisión configurada
                — no se les calcula nada. Configurá la regla en Profesionales.
              </p>
            )}

            <div className="card-clinical overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profesional</TableHead>
                    <TableHead>Regla</TableHead>
                    <TableHead className="text-right">Procedimientos</TableHead>
                    <TableHead className="text-right">Producción</TableHead>
                    <TableHead className="text-right">Comisión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineas.map((l) => (
                    <TableRow key={l.professionalId}>
                      <TableCell className="font-medium">{l.professionalName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.ruleLabel}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.procedureCount}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(l.productionCents, currency)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {l.commissionCents === null
                          ? "—"
                          : formatMoney(l.commissionCents, currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {lineas.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No hay profesionales cargados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
