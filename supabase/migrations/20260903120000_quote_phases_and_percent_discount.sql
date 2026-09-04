-- Tanda A · G-2 (fases y secciones) + G-5 (descuento en porcentaje).
--
-- Contexto: análisis competitivo contra Dentalink (03-sep-2026). Su plan de
-- tratamiento agrupa las prestaciones en bloques ("Sección sin nombre",
-- "Fase 1", "Fase 2") con subtotal por bloque, y negocia los descuentos en
-- porcentaje, no en pesos. Alika tenía lista plana y descuento absoluto.
--
-- ── Por qué `phase_label` es text libre y no una tabla de fases ───────────
-- Obligar a la clínica a configurar un catálogo de fases antes de poder
-- presupuestar es fricción de onboarding pura. Cada clínica nombra sus
-- bloques distinto ("Fase 1", "Rehabilitación", "Primera etapa") y ninguna
-- lógica del sistema necesita conocer el conjunto de valores posibles: la
-- fase solo agrupa y ordena en pantalla. Si algún día hace falta reportar
-- por fase, se normaliza entonces con los datos reales a la vista.
--
-- NULL en `phase_label` significa "sin fase" y agrupa en un bloque implícito
-- al principio — es el equivalente de la "Sección sin nombre" de Dentalink, y
-- deja intacto el comportamiento de todo presupuesto ya cargado.
--
-- ── Por qué `discount_pct` NO reemplaza a `discount_cents` ────────────────
-- Regla 6 del CLAUDE.md: el dinero es bigint cents y esa es la verdad
-- contable. El porcentaje es la *intención* del que negocia; los cents son
-- lo que efectivamente se cobra. Guardamos los dos: el server deriva los
-- cents desde el pct cuando el pct viene, y `discount_pct` queda NULL cuando
-- el descuento se cargó directamente en pesos (regla 11: nullable en vez de
-- fabricar un cero que miente). Así ningún cálculo existente cambia de
-- resultado y la UI puede mostrar "10%" en vez de "$35.000" cuando
-- corresponde.
--
-- Sin backfill a propósito: los ítems viejos con descuento en pesos quedan
-- con pct NULL, que es exactamente lo que fueron.

-- ── G-2 · Fases ──────────────────────────────────────────────────────────

ALTER TABLE public.quote_items
  ADD COLUMN phase_label text,
  ADD COLUMN phase_position smallint NOT NULL DEFAULT 0;

ALTER TABLE public.treatment_items
  ADD COLUMN phase_label text,
  ADD COLUMN phase_position smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.quote_items.phase_label IS
  'Nombre libre del bloque que agrupa el ítem ("Fase 1", "Rehabilitación"). NULL = sin fase.';
COMMENT ON COLUMN public.quote_items.phase_position IS
  'Orden del bloque dentro del presupuesto. Los ítems de una misma fase comparten el valor.';

-- El orden de lectura pasa a ser (phase_position, position): primero el
-- bloque, después el ítem dentro del bloque.
DROP INDEX IF EXISTS public.quote_items_quote_idx;
CREATE INDEX quote_items_quote_idx
  ON public.quote_items (quote_id, phase_position, position);

DROP INDEX IF EXISTS public.treatment_items_plan_idx;
CREATE INDEX treatment_items_plan_idx
  ON public.treatment_items (plan_id, phase_position, position);

-- ── G-5 · Descuento en porcentaje ────────────────────────────────────────

ALTER TABLE public.quote_items
  ADD COLUMN discount_pct numeric(5,2)
    CHECK (discount_pct IS NULL OR (discount_pct >= 0 AND discount_pct <= 100));

ALTER TABLE public.quotes
  ADD COLUMN commercial_discount_pct numeric(5,2)
    CHECK (commercial_discount_pct IS NULL OR
           (commercial_discount_pct >= 0 AND commercial_discount_pct <= 100));

COMMENT ON COLUMN public.quote_items.discount_pct IS
  'Descuento negociado en %, del que se deriva discount_cents. NULL = se cargó en pesos.';
COMMENT ON COLUMN public.quotes.commercial_discount_pct IS
  'Descuento comercial global en %, del que se deriva discount_cents del presupuesto.';

-- ── Trigger de conversión: arrastrar las fases al plan ───────────────────
-- Mismo cuerpo que la versión original de 20260812210000, con phase_label y
-- phase_position sumados al INSERT ... SELECT. Sin esto, aceptar un
-- presupuesto con fases produce un plan plano y se pierde el agrupamiento
-- justo en el momento en que el paciente dijo que sí.

CREATE OR REPLACE FUNCTION public.convert_accepted_quote_to_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_plan_id uuid;
  plan_name text;
BEGIN
  IF NEW.status <> 'accepted' OR OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  plan_name := 'Plan de ' || COALESCE(NEW.number, 'presupuesto');

  INSERT INTO public.treatment_plans (
    clinic_id, patient_id, quote_id, name, status, total_cents, currency, created_by
  )
  VALUES (
    NEW.clinic_id, NEW.patient_id, NEW.id, plan_name, 'active',
    NEW.total_cents, NEW.currency, NEW.created_by
  )
  RETURNING id INTO new_plan_id;

  INSERT INTO public.treatment_items (
    clinic_id, plan_id, procedure_id, quote_item_id, name_snapshot,
    tooth_number, surface, status, price_cents, position, notes,
    phase_label, phase_position
  )
  SELECT
    qi.clinic_id, new_plan_id, qi.procedure_id, qi.id, qi.name_snapshot,
    qi.tooth_number, qi.surface, 'pending'::public.treatment_item_status,
    qi.total_cents, qi.position, qi.notes,
    qi.phase_label, qi.phase_position
  FROM public.quote_items qi
  WHERE qi.quote_id = NEW.id
  ORDER BY qi.phase_position, qi.position;

  NEW.status := 'converted';
  NEW.accepted_at := COALESCE(NEW.accepted_at, now());
  RETURN NEW;
END;
$$;
