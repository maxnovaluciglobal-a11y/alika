/**
 * Conversión de USD a monedas locales LATAM para mostrar como referencia
 * junto al precio en dólares. PURAMENTE DECORATIVO / INFORMATIVO.
 *
 * Esto NO es dinero real de la app (no tiene nada que ver con `finance.ts`,
 * `formatMoney`, ni con montos cobrados por Stripe). El cobro real siempre
 * es US$49/mes flat, en USD, vía `src/lib/billing.functions.ts` — este
 * archivo no debe tocarse ni usarse para calcular nada que afecte un cobro.
 *
 * Tipos de cambio APROXIMADOS, cargados a mano el 2026-08-22 (cotización
 * spot USD/CLP, USD/MXN, USD/COP consultada ese día). Fluctúan a diario —
 * esto es solo para que el usuario tenga una idea de magnitud, no una
 * cotización exacta. Sería sobre-ingeniería conectar una API de tipo de
 * cambio en vivo para un dato secundario como este. Actualizar de tanto en
 * tanto (cada 2-3 meses está bien) editando los valores de abajo.
 */
const USD_TO_LOCAL_APPROX = {
  CLP: 920,
  MXN: 17,
  COP: 3080,
} as const;

/** Redondea a un número "lindo" para reforzar que es una cifra aproximada. */
function roundApprox(value: number): number {
  if (value >= 100_000) return Math.round(value / 1000) * 1000;
  if (value >= 1_000) return Math.round(value / 100) * 100;
  return Math.round(value / 10) * 10;
}

function formatLocal(value: number): string {
  return new Intl.NumberFormat("es-CL").format(value);
}

/**
 * Devuelve un string tipo "≈ $45.200 CLP · $830 MXN · $150.900 COP" para
 * un precio en USD. Pensado para ir como texto secundario/chico al lado
 * del precio real en USD, nunca reemplazándolo.
 */
export function approxLocalPricesLabel(usd: number): string {
  const clp = roundApprox(usd * USD_TO_LOCAL_APPROX.CLP);
  const mxn = roundApprox(usd * USD_TO_LOCAL_APPROX.MXN);
  const cop = roundApprox(usd * USD_TO_LOCAL_APPROX.COP);
  return `≈ $${formatLocal(clp)} CLP · $${formatLocal(mxn)} MXN · $${formatLocal(cop)} COP`;
}
