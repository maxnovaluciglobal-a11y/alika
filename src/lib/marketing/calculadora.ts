//
// Cálculo de la calculadora pública. Módulo puro: sin React, sin Supabase,
// sin fetch. Todo en cents, igual que el resto del producto — la conversión
// a unidad visible la hace formatMoney con la moneda del país elegido.
//
// Las fórmulas son las del producto, no inventadas:
//   - la retención del medio de pago usa netAfterRetention (finance.ts:77)
//   - el resultado del período replica getFinanceSummary: neto − gastos
// Si acá dijéramos algo distinto de lo que Alika muestra adentro, el lead
// magnet estaría prometiendo una pantalla que no existe.

import { netAfterRetention } from "@/lib/finance/finance";

export type EntradaPL = {
  ingresosCents: number;
  honorariosCents: number;
  sueldosCents: number;
  insumosCents: number;
  laboratorioCents: number;
  fijosCents: number;
  variablesCents: number;
  /** % que retiene el medio de pago (ej. 2.95). 0 = sin retención. */
  retencionPct: number;
};

export type ResultadoPL = {
  ingresoNetoCents: number;
  retencionCents: number;
  costosTotalesCents: number;
  utilidadCents: number;
  /** null cuando no hay ingresos: sin dato, no cero. */
  margenPct: number | null;
  puntoEquilibrioCents: number | null;
  distribucion: {
    honorarios: number | null;
    sueldos: number | null;
    insumos: number | null;
    laboratorio: number | null;
    fijos: number | null;
    variables: number | null;
  };
};

function porcentajeSobre(parte: number, total: number): number | null {
  if (total <= 0) return null;
  return (parte / total) * 100;
}

export function calcularPL(e: EntradaPL): ResultadoPL {
  const ingresoNetoCents = netAfterRetention(e.ingresosCents, e.retencionPct);
  const retencionCents = e.ingresosCents - ingresoNetoCents;

  const costosTotalesCents =
    e.honorariosCents +
    e.sueldosCents +
    e.insumosCents +
    e.laboratorioCents +
    e.fijosCents +
    e.variablesCents;

  const utilidadCents = ingresoNetoCents - costosTotalesCents;
  const margenPct = porcentajeSobre(utilidadCents, e.ingresosCents);

  // Punto de equilibrio: los honorarios del profesional son variables (se
  // pagan por producción); los sueldos del equipo de apoyo son fijos (se
  // pagan atienda o no). Es la diferencia estructural con un restaurante.
  const variablesCents = e.honorariosCents + e.insumosCents + e.laboratorioCents + e.variablesCents;
  const fijosCents = e.fijosCents + e.sueldosCents;
  const ratioContribucion =
    e.ingresosCents > 0 ? (ingresoNetoCents - variablesCents) / e.ingresosCents : 0;
  const puntoEquilibrioCents =
    ratioContribucion > 0 ? Math.round(fijosCents / ratioContribucion) : null;

  return {
    ingresoNetoCents,
    retencionCents,
    costosTotalesCents,
    utilidadCents,
    margenPct,
    puntoEquilibrioCents,
    distribucion: {
      honorarios: porcentajeSobre(e.honorariosCents, e.ingresosCents),
      sueldos: porcentajeSobre(e.sueldosCents, e.ingresosCents),
      insumos: porcentajeSobre(e.insumosCents, e.ingresosCents),
      laboratorio: porcentajeSobre(e.laboratorioCents, e.ingresosCents),
      fijos: porcentajeSobre(e.fijosCents, e.ingresosCents),
      variables: porcentajeSobre(e.variablesCents, e.ingresosCents),
    },
  };
}

export type EntradaFugas = {
  citasPorMes: number;
  ausenciasPct: number;
  ticketPromedioCents: number;
  presupuestosPorMes: number;
  aceptacionPct: number;
  /** Referencia contra la que se compara la aceptación. NO tiene benchmark
   *  citable: el 61% que circula es de 2016 y no se pudo verificar contra el
   *  informe original. Por eso es un parámetro que fija el usuario en la UI
   *  (default 60 sólo como punto de partida editable), y el resultado se
   *  presenta como "si llegaras a X%", nunca como "estás por debajo de la
   *  industria". */
  aceptacionReferenciaPct: number;
  retencionCents: number;
};

export type ResultadoFugas = {
  perdidaAusenciasCents: number | null;
  oportunidadPresupuestosCents: number | null;
  retencionCents: number;
  totalRecuperableCents: number | null;
};

export function calcularFugas(e: EntradaFugas): ResultadoFugas {
  const sinTicket = e.ticketPromedioCents <= 0;

  const perdidaAusenciasCents = sinTicket
    ? null
    : Math.round(e.citasPorMes * (e.ausenciasPct / 100) * e.ticketPromedioCents);

  const brecha = Math.max(0, e.aceptacionReferenciaPct - e.aceptacionPct);
  const oportunidadPresupuestosCents = sinTicket
    ? null
    : Math.round(e.presupuestosPorMes * (brecha / 100) * e.ticketPromedioCents);

  const totalRecuperableCents =
    perdidaAusenciasCents === null || oportunidadPresupuestosCents === null
      ? null
      : perdidaAusenciasCents + oportunidadPresupuestosCents + e.retencionCents;

  return {
    perdidaAusenciasCents,
    oportunidadPresupuestosCents,
    retencionCents: e.retencionCents,
    totalRecuperableCents,
  };
}

export function bucketDeMargen(pct: number | null): "perdida" | "bajo" | "medio" | "alto" | "na" {
  if (pct === null) return "na";
  if (pct < 0) return "perdida";
  if (pct < 8) return "bajo";
  if (pct < 18) return "medio";
  return "alto";
}
