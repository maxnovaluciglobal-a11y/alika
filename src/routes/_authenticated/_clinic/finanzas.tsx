import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CircleDollarSign, Receipt, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DateField, FilterBar } from "@/components/filters";
import { requirePermission } from "@/lib/route-guards";
import { hoyISO } from "@/lib/clinic-data";
import { formatMoney, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/finance";
import { getFinanceSummary, getQuoteConversionReport } from "@/lib/finance-reports.functions";
import { str } from "@/lib/search";

interface FinanzasSearch {
  desde: string;
  hasta: string;
}

/** Primer día del mes actual, en la timezone por defecto (mismo criterio simplificado que el resto del proyecto para filtros de rango). */
function primerDiaDelMes(): string {
  const hoy = hoyISO();
  return `${hoy.slice(0, 7)}-01`;
}

export const Route = createFileRoute("/_authenticated/_clinic/finanzas")({
  validateSearch: (search: Record<string, unknown>): FinanzasSearch => ({
    desde: str(search.desde, primerDiaDelMes()),
    hasta: str(search.hasta, hoyISO()),
  }),
  beforeLoad: requirePermission("finance:view"),
  head: () => ({
    meta: [
      { title: "Finanzas | Alika" },
      {
        name: "description",
        content: "Caja del período, desglose por método de pago y producción por profesional.",
      },
      { property: "og:title", content: "Finanzas | Alika" },
      {
        property: "og:description",
        content: "Caja, métodos de pago y producción por profesional en un rango de fechas.",
      },
    ],
  }),
  component: FinanzasPage,
});

function FinanzasPage() {
  const { access } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const clinicId = access.clinic?.id;

  const fetchSummary = useServerFn(getFinanceSummary);
  const { data: resumen, isLoading } = useQuery({
    queryKey: ["finance-summary", clinicId, search.desde, search.hasta],
    enabled: Boolean(clinicId),
    queryFn: () =>
      fetchSummary({ data: { clinicId: clinicId!, desde: search.desde, hasta: search.hasta } }),
  });

  const fetchConversion = useServerFn(getQuoteConversionReport);
  const { data: conversion } = useQuery({
    queryKey: ["quote-conversion", clinicId, search.desde, search.hasta],
    enabled: Boolean(clinicId),
    queryFn: () =>
      fetchConversion({ data: { clinicId: clinicId!, desde: search.desde, hasta: search.hasta } }),
  });

  const set = (patch: Partial<FinanzasSearch>) =>
    navigate({ search: (prev: FinanzasSearch) => ({ ...prev, ...patch }) });

  const currency = resumen?.currency ?? "CLP";
  const maxDia = Math.max(1, ...(resumen?.byDay.map((d) => d.totalCents) ?? [1]));

  return (
    <AppShell title="Finanzas" access={access}>
      <div className="space-y-6">
        <FilterBar activos={0} onReset={() => set({ desde: primerDiaDelMes(), hasta: hoyISO() })}>
          <DateField label="Desde" value={search.desde} onChange={(desde) => set({ desde })} />
          <DateField label="Hasta" value={search.hasta} onChange={(hasta) => set({ hasta })} />
        </FilterBar>

        {isLoading && (
          <p className="px-1 py-10 text-center text-sm text-muted-foreground">Cargando…</p>
        )}

        {!isLoading && resumen && (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="card-clinical p-5">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <CircleDollarSign className="size-3.5" /> Total cobrado
                </p>
                <p className="font-display text-2xl font-semibold">
                  {formatMoney(resumen.totalCents, currency)}
                </p>
              </div>
              <div className="card-clinical p-5">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Receipt className="size-3.5" /> Pagos registrados
                </p>
                <p className="font-display text-2xl font-semibold">{resumen.paymentsCount}</p>
              </div>
              <div className="card-clinical p-5">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <TrendingUp className="size-3.5" /> Ticket promedio
                </p>
                <p className="font-display text-2xl font-semibold">
                  {formatMoney(resumen.averageTicketCents, currency)}
                </p>
              </div>
            </section>

            {conversion && conversion.created > 0 && (
              <section className="card-clinical p-5">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Conversión de presupuestos
                </p>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <p className="font-display text-2xl font-semibold">
                      {conversion.conversionRate === null ? "—" : `${conversion.conversionRate}%`}
                    </p>
                    <p className="text-xs text-muted-foreground">Tasa de conversión</p>
                  </div>
                  <div>
                    <p className="font-display text-2xl font-semibold text-success">
                      {conversion.accepted}
                    </p>
                    <p className="text-xs text-muted-foreground">Aceptados</p>
                  </div>
                  <div>
                    <p className="font-display text-2xl font-semibold text-destructive">
                      {conversion.rejected}
                    </p>
                    <p className="text-xs text-muted-foreground">Rechazados</p>
                  </div>
                  <div>
                    <p className="font-display text-2xl font-semibold text-muted-foreground">
                      {conversion.pending}
                    </p>
                    <p className="text-xs text-muted-foreground">Pendientes</p>
                  </div>
                </div>
                <p className="mt-4 border-t border-hairline pt-3 text-xs text-muted-foreground">
                  {conversion.created} presupuesto{conversion.created === 1 ? "" : "s"} creado
                  {conversion.created === 1 ? "" : "s"} por{" "}
                  {formatMoney(conversion.createdTotalCents, currency)} · aceptado por{" "}
                  <span className="font-medium text-foreground">
                    {formatMoney(conversion.acceptedTotalCents, currency)}
                  </span>
                </p>
              </section>
            )}

            <section className="card-clinical overflow-hidden">
              <div className="border-b border-hairline bg-secondary/40 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Caja por día
              </div>
              {resumen.byDay.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Sin pagos registrados en este rango.
                </p>
              ) : (
                <div className="space-y-2.5 p-5">
                  {resumen.byDay.map((d) => (
                    <div key={d.date} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                        {d.date}
                      </span>
                      <div className="h-5 flex-1 overflow-hidden rounded bg-secondary/60">
                        <div
                          className="h-full rounded bg-chart-1"
                          style={{ width: `${Math.max(4, (d.totalCents / maxDia) * 100)}%` }}
                        />
                      </div>
                      <span className="w-28 shrink-0 text-right text-xs font-medium tabular-nums">
                        {formatMoney(d.totalCents, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="card-clinical overflow-hidden">
                <div className="border-b border-hairline bg-secondary/40 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Por método de pago
                </div>
                <div className="divide-y divide-hairline">
                  {resumen.byMethod.length === 0 && (
                    <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                      Sin datos en este rango.
                    </p>
                  )}
                  {resumen.byMethod.map((m) => (
                    <div key={m.method} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium">
                          {PAYMENT_METHOD_LABELS[m.method as PaymentMethod] ?? m.method}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {m.count} pago{m.count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="text-sm font-medium tabular-nums">
                        {formatMoney(m.totalCents, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-clinical overflow-hidden">
                <div className="border-b border-hairline bg-secondary/40 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Producción por profesional
                </div>
                <div className="divide-y divide-hairline">
                  {resumen.byProfessional.length === 0 && (
                    <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                      Sin ítems completados en este rango.
                    </p>
                  )}
                  {resumen.byProfessional.map((p) => (
                    <div
                      key={p.professionalId}
                      className="flex items-center justify-between px-5 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{p.professionalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.itemsCount} ítem{p.itemsCount === 1 ? "" : "s"} completado
                          {p.itemsCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="text-sm font-medium tabular-nums">
                        {formatMoney(p.totalCents, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
