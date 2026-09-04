-- Tanda B (1/2) · G-4 arancel de precios + G-6 medios de pago con retención
-- + módulo de gastos. Convenios van en la migración siguiente porque dependen
-- del arancel ya extendido.
--
-- Las tres piezas cierran el circuito del dinero: de la lista de precios
-- (arancel) a lo que efectivamente entra al banco (retención) menos lo que
-- sale (gastos). Hasta ahora "Finanzas" sumaba cobros y nada más, así que no
-- podía responder la única pregunta que le importa a un dueño de clínica:
-- si ganó plata.

-- ── G-4 · Arancel de precios ─────────────────────────────────────────────
-- `procedures` existía desde agosto pero sin pantalla de gestión: un
-- procedimiento solo nacía escribiéndolo dentro del diálogo de un
-- presupuesto. Ninguna clínica carga 300 prestaciones así, y sin arancel no
-- hay forma de que un cliente traiga su lista de precios al migrar.

ALTER TABLE public.procedures
  -- Dentalink tiene este flag por prestación y es una regla real de negocio:
  -- hay convenios y prestaciones bonificadas donde el descuento no aplica.
  ADD COLUMN allows_discount boolean NOT NULL DEFAULT true,
  -- Segundo precio "de referencia" (el V.R. de Dentalink): lo que la clínica
  -- declara ante un convenio o arancel público, distinto del precio final que
  -- le cobra al paciente. Nullable: sin dato no es cero (regla 11).
  ADD COLUMN reference_price_cents bigint
    CHECK (reference_price_cents IS NULL OR reference_price_cents >= 0),
  -- Costo de laboratorio de la prestación. Nullable por lo mismo. Alimenta el
  -- margen real por prestación y prepara el módulo de laboratorios (Tanda C).
  ADD COLUMN lab_cost_cents bigint
    CHECK (lab_cost_cents IS NULL OR lab_cost_cents >= 0),
  -- Orden manual dentro de la categoría; el desempate sigue siendo el nombre.
  ADD COLUMN position smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.procedures.allows_discount IS
  'Si false, la UI no deja aplicar descuento a esta prestación en el presupuesto.';
COMMENT ON COLUMN public.procedures.reference_price_cents IS
  'Precio de referencia / valor referencial. NULL = sin dato, no cero.';
COMMENT ON COLUMN public.procedures.lab_cost_cents IS
  'Costo de laboratorio de la prestación. NULL = sin dato, no cero.';

CREATE INDEX procedures_clinic_position_idx
  ON public.procedures (clinic_id, category, position, name);

-- ── G-6 · Medios de pago configurables con retención ─────────────────────
-- El enum `payment_method` de cinco valores no tiene retención, así que el
-- reporte de finanzas mostraba lo facturado y no lo que entra al banco. Para
-- el dueño de la clínica esa diferencia ES su margen: una tarjeta de crédito
-- al 2,95 % sobre el volumen de un mes no es un detalle.
--
-- El enum NO se elimina: `payments.method` sigue existiendo y los pagos
-- históricos siguen leyéndose igual. `legacy_key` conecta cada medio nuevo
-- con su valor del enum para que el histórico y lo nuevo convivan.

CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  -- Comisión que retiene el operador (2.95 = 2,95 %). No es un descuento al
  -- paciente: el paciente paga el total, la clínica recibe menos.
  retention_pct numeric(5,2) NOT NULL DEFAULT 0
    CHECK (retention_pct >= 0 AND retention_pct <= 100),
  allows_refund boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  position smallint NOT NULL DEFAULT 0,
  -- Puente con el enum viejo. Nullable: una clínica puede crear "Klap crédito"
  -- o "Bono Fonasa", que no mapean a ninguno de los cinco originales.
  legacy_key public.payment_method,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, name)
);

CREATE INDEX payment_methods_clinic_idx
  ON public.payment_methods (clinic_id, is_active, position, name);
CREATE TRIGGER payment_methods_updated_at BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- SELECT: todo miembro. Recepción necesita elegir el medio al cobrar en la
-- puerta, igual que hoy elige un valor del enum.
CREATE POLICY "payment_methods_select_members" ON public.payment_methods
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));

-- Configurar la lista y las retenciones es de owner/admin: es un parámetro
-- contable, no una decisión de mostrador.
CREATE POLICY "payment_methods_write_managers" ON public.payment_methods
  FOR ALL TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));

ALTER TABLE public.payments
  ADD COLUMN payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  -- Snapshot inmutable (regla 10): renombrar o borrar el medio de pago no
  -- puede mutar lo que dice un recibo ya emitido.
  ADD COLUMN method_name_snapshot text,
  -- Neto que entra a la clínica tras la retención, congelado al cobrar. NO se
  -- recalcula en runtime desde `retention_pct`: la comisión cambia con el
  -- tiempo y el histórico tiene que conservar lo que realmente entró.
  -- NULL en los pagos anteriores a esta migración: sin dato, no cero.
  ADD COLUMN net_cents bigint CHECK (net_cents IS NULL OR net_cents >= 0);

COMMENT ON COLUMN public.payments.net_cents IS
  'Neto tras retención, congelado al cobrar. NULL = pago anterior a los medios configurables.';

-- Siembra los cinco medios equivalentes al enum en cada clínica nueva. Va en
-- un trigger propio y NO dentro de `handle_new_clinic`: esa función ya
-- concentra el alta del owner y nueve plantillas de mensaje, y redefinirla
-- entera para sumar cinco filas es copiar un cuerpo largo con riesgo de
-- perder algo en el camino. Postgres corre los AFTER INSERT en orden
-- alfabético de nombre y estos no dependen entre sí.
CREATE OR REPLACE FUNCTION public.seed_clinic_payment_methods()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.payment_methods
    (clinic_id, name, retention_pct, allows_refund, position, legacy_key)
  VALUES
    (NEW.id, 'Efectivo',            0,    true,  0, 'cash'),
    (NEW.id, 'Transferencia',       0,    true,  1, 'transfer'),
    (NEW.id, 'Tarjeta de débito',   0,    false, 2, 'debit_card'),
    (NEW.id, 'Tarjeta de crédito',  0,    false, 3, 'credit_card'),
    (NEW.id, 'Otro',                0,    false, 4, 'other')
  ON CONFLICT (clinic_id, name) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_clinic_created_payment_methods
  AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.seed_clinic_payment_methods();

-- Backfill para las clínicas que ya existen. Retención en 0 a propósito: no
-- sabemos qué cobra el operador de cada una, y poner un número inventado sería
-- peor que dejar que lo configuren. `payments.net_cents` de lo ya cobrado
-- queda NULL — no reescribimos historia contable.
INSERT INTO public.payment_methods
  (clinic_id, name, retention_pct, allows_refund, position, legacy_key)
SELECT c.id, m.name, 0, m.allows_refund, m.position, m.legacy_key
FROM public.clinics c
CROSS JOIN (VALUES
  ('Efectivo',           true,  0::smallint, 'cash'::public.payment_method),
  ('Transferencia',      true,  1::smallint, 'transfer'::public.payment_method),
  ('Tarjeta de débito',  false, 2::smallint, 'debit_card'::public.payment_method),
  ('Tarjeta de crédito', false, 3::smallint, 'credit_card'::public.payment_method),
  ('Otro',               false, 4::smallint, 'other'::public.payment_method)
) AS m(name, allows_refund, position, legacy_key)
ON CONFLICT (clinic_id, name) DO NOTHING;

-- ── Gastos ───────────────────────────────────────────────────────────────
-- Sin esto "Finanzas" es un listado de cobros, no un estado de resultados.

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  -- NULL = gasto de la clínica entera, no de una sede puntual.
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  -- Categoría de texto libre, mismo criterio que `phase_label`: obligar a
  -- configurar un catálogo de categorías antes de poder cargar el primer
  -- gasto es fricción de onboarding. La UI sugiere las ya usadas.
  category text NOT NULL,
  description text NOT NULL,
  supplier text,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'CLP',
  payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  method_name_snapshot text,
  -- `date` y no `timestamptz`: un gasto pertenece a un día contable, no a un
  -- instante. Guardarlo como timestamp obliga a decidir una timezone que a
  -- nadie le importa y corre el gasto de mes en el borde (ver el comentario
  -- de tz en finance-reports.functions.ts).
  incurred_on date NOT NULL,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX expenses_clinic_date_idx ON public.expenses (clinic_id, incurred_on DESC);
CREATE INDEX expenses_clinic_category_idx ON public.expenses (clinic_id, category);
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Los gastos son información financiera sensible: cuánto paga la clínica de
-- arriendo o de sueldos no es asunto de recepción ni de los asistentes. Mismo
-- conjunto de roles que ya tiene `finance:view` en la matriz de la app
-- (owner, admin, accounting) — acá se replica a nivel RLS.
CREATE POLICY "expenses_select_finance_roles" ON public.expenses
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(clinic_id, ARRAY['owner','admin','accounting']::public.app_role[])
  );

-- Escritura para los mismos: el contador es justamente quien carga los gastos,
-- así que NO puede quedar restringido a can_manage_clinic (owner/admin).
CREATE POLICY "expenses_write_finance_roles" ON public.expenses
  FOR ALL TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','accounting']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','accounting']::public.app_role[]));
