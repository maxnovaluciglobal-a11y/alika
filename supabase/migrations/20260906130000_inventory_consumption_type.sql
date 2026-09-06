-- Tanda 2 · Consumo variable y factor de merma.
--
-- La Tanda 1 (procedure_supplies) trata todo insumo igual: receta fija,
-- descuento automático sin fricción. Pero no todo insumo tiene la misma
-- variabilidad real — un guante se abre entero siempre (la receta ya es
-- exacta), mientras que las gasas dependen del caso clínico. Esta migración
-- clasifica el insumo (no la receta) y agrega el factor de rendimiento que
-- ya está probado en producción en DypOS (`ingredients.yield_pct`).

ALTER TABLE public.inventory_items
  ADD COLUMN consumption_type text NOT NULL DEFAULT 'fixed'
    CHECK (consumption_type IN ('fixed', 'variable', 'shared')),
  ADD COLUMN yield_pct numeric(5,2) NOT NULL DEFAULT 100.00
    CHECK (yield_pct > 0 AND yield_pct <= 100);

COMMENT ON COLUMN public.inventory_items.consumption_type IS
  'fixed = uso único indivisible (la receta ya es exacta). variable = fraccionable, vale la pena ajustar en el momento. shared = no correlaciona 1:1 con un procedimiento, no se ofrece al armar una receta.';
COMMENT ON COLUMN public.inventory_items.yield_pct IS
  'Rendimiento esperado, 100 = sin merma. Con menos de 100 se descuenta más de lo que dice la receta para reflejar la merma real — misma fórmula que yield_pct en DypOS, aplicada a cantidad en vez de costo.';
