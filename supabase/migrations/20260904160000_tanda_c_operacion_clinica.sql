-- Tanda C · Operación de clínica mediana.
--
-- Lo que separa "sirve para un consultorio" de "sirve para una clínica con
-- cuatro sillones": laboratorios, bodegas de verdad, estados de cita con el
-- vocabulario de cada clínica, y fusión de fichas duplicadas.
--
-- Las cinco piezas son independientes entre sí; van juntas porque aplicarlas
-- de a una multiplica las idas y vueltas al SQL Editor sin ganar nada.

-- ═══ 1 · LABORATORIOS ════════════════════════════════════════════════════
-- Toda clínica que hace prótesis lleva hoy un cuaderno aparte: qué mandó, a
-- quién, cuándo lo prometieron y cuánto costó. Sin esto, el trabajo de
-- laboratorio es el único tramo del tratamiento que el sistema no ve.

CREATE TABLE public.labs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_name text,
  contact_phone text,
  contact_email text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, name)
);

CREATE INDEX labs_clinic_idx ON public.labs (clinic_id, is_active, name);
CREATE TRIGGER labs_updated_at BEFORE UPDATE ON public.labs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.labs TO authenticated;
GRANT ALL ON public.labs TO service_role;
ALTER TABLE public.labs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "labs_select_members" ON public.labs
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "labs_write_managers" ON public.labs
  FOR ALL TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));

-- 'reprocesar' es un estado real y frecuente (el trabajo vuelve porque no
-- ajusta), no una variante de 'enviado': saber cuántas veces reprocesa cada
-- laboratorio es justamente el dato que decide si se sigue trabajando con él.
CREATE TYPE public.lab_order_status AS ENUM (
  'enviado', 'en_proceso', 'recibido', 'reprocesar', 'cancelado'
);

CREATE TABLE public.lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  lab_id uuid REFERENCES public.labs(id) ON DELETE SET NULL,
  lab_name_snapshot text,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- Qué prestación del plan motivó el trabajo. Nullable: se puede mandar algo
  -- al laboratorio antes de tener el plan armado.
  treatment_item_id uuid REFERENCES public.treatment_items(id) ON DELETE SET NULL,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  description text NOT NULL,
  tooth_numbers smallint[],
  status public.lab_order_status NOT NULL DEFAULT 'enviado',
  -- Fechas como `date`: son días de calendario del taller, no instantes.
  sent_on date NOT NULL DEFAULT CURRENT_DATE,
  due_on date,
  received_on date,
  cost_cents bigint CHECK (cost_cents IS NULL OR cost_cents >= 0),
  currency text NOT NULL DEFAULT 'CLP',
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lab_orders_clinic_status_idx ON public.lab_orders (clinic_id, status, due_on);
CREATE INDEX lab_orders_patient_idx ON public.lab_orders (clinic_id, patient_id, sent_on DESC);
CREATE TRIGGER lab_orders_updated_at BEFORE UPDATE ON public.lab_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_orders TO authenticated;
GRANT ALL ON public.lab_orders TO service_role;
ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;

-- Una orden de laboratorio nombra a un paciente y su tratamiento: es dato
-- clínico. Mismo conjunto que ya rige `clinical_notes`, más reception, que es
-- quien recibe el paquete cuando llega.
CREATE POLICY "lab_orders_select_clinical" ON public.lab_orders
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(
      clinic_id, ARRAY['owner','admin','dentist','assistant','reception']::public.app_role[]
    )
  );
CREATE POLICY "lab_orders_write_clinical" ON public.lab_orders
  FOR ALL TO authenticated
  USING (public.has_clinic_role(
    clinic_id, ARRAY['owner','admin','dentist','assistant','reception']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(
    clinic_id, ARRAY['owner','admin','dentist','assistant','reception']::public.app_role[]));

-- ═══ 2 · BODEGAS ═════════════════════════════════════════════════════════
-- `inventory_items.branch_id` (20260827050000) solo ETIQUETA a qué sede
-- pertenece un ítem: `current_stock` sigue siendo un número único por ítem.
-- Una clínica con dos sedes no puede responder "cuántos guantes hay en
-- Providencia" — que es la única pregunta que importa cuando hay que reponer.
--
-- El saldo por bodega vive en `inventory_stock` y NO reemplaza a
-- `inventory_items.current_stock`: ese queda como total de la clínica, que es
-- lo que alimenta el semáforo global y lo que ya leen las pantallas de hoy.

CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  position smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, name)
);

CREATE INDEX warehouses_clinic_idx ON public.warehouses (clinic_id, is_active, position, name);
CREATE TRIGGER warehouses_updated_at BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouses_select_clinical" ON public.warehouses
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(
      clinic_id, ARRAY['owner','admin','dentist','assistant','reception']::public.app_role[]
    )
  );
CREATE POLICY "warehouses_write_managers" ON public.warehouses
  FOR ALL TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));

CREATE TABLE public.inventory_stock (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  current_stock numeric NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, warehouse_id)
);

CREATE INDEX inventory_stock_clinic_idx ON public.inventory_stock (clinic_id, warehouse_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_stock TO authenticated;
GRANT ALL ON public.inventory_stock TO service_role;
ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_stock_select_clinical" ON public.inventory_stock
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(
      clinic_id, ARRAY['owner','admin','dentist','assistant','reception']::public.app_role[]
    )
  );
-- Escritura solo por el trigger (SECURITY DEFINER): la app nunca toca el saldo
-- a mano, igual que hoy con `inventory_items.current_stock`.

ALTER TABLE public.inventory_movements
  ADD COLUMN warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  -- Costo unitario de esta entrada. Alimenta el precio promedio ponderado, que
  -- se calcula desde el historial y no se guarda: guardarlo obligaría a
  -- recalcularlo en cada movimiento y a mantener dos verdades.
  ADD COLUMN unit_cost_cents bigint CHECK (unit_cost_cents IS NULL OR unit_cost_cents >= 0);

ALTER TABLE public.inventory_items
  -- Precio al que la clínica revende el insumo, cuando lo revende.
  ADD COLUMN sale_price_cents bigint CHECK (sale_price_cents IS NULL OR sale_price_cents >= 0);

-- Una bodega "General" por clínica, para que el módulo funcione sin
-- configurar nada y los movimientos existentes tengan dónde caer.
INSERT INTO public.warehouses (clinic_id, name, position)
SELECT id, 'Bodega general', 0 FROM public.clinics
ON CONFLICT (clinic_id, name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_clinic_warehouse()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.warehouses (clinic_id, name, position)
  VALUES (NEW.id, 'Bodega general', 0)
  ON CONFLICT (clinic_id, name) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_clinic_created_warehouse
  AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.seed_clinic_warehouse();

-- Backfill: el stock actual de cada ítem se asigna entero a la bodega general.
-- Es la única repartición honesta posible — nadie registró en qué bodega
-- estaba, y distribuirlo por criterio inventado sería peor.
INSERT INTO public.inventory_stock (clinic_id, item_id, warehouse_id, current_stock)
SELECT i.clinic_id, i.id, w.id, i.current_stock
FROM public.inventory_items i
JOIN public.warehouses w ON w.clinic_id = i.clinic_id AND w.name = 'Bodega general'
ON CONFLICT (item_id, warehouse_id) DO NOTHING;

-- El trigger de stock pasa a mantener las dos vistas: el total del ítem (como
-- siempre) y el saldo de la bodega del movimiento. Un movimiento sin bodega
-- cae en la general, que es lo que hace toda clínica de una sola sede.
CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_warehouse uuid;
BEGIN
  IF NEW.kind = 'entrada' THEN
    UPDATE public.inventory_items
       SET current_stock = current_stock + NEW.quantity
     WHERE id = NEW.item_id AND clinic_id = NEW.clinic_id;
  ELSIF NEW.kind = 'salida' THEN
    UPDATE public.inventory_items
       SET current_stock = current_stock - NEW.quantity
     WHERE id = NEW.item_id AND clinic_id = NEW.clinic_id;
  ELSIF NEW.kind = 'ajuste' THEN
    UPDATE public.inventory_items
       SET current_stock = NEW.quantity
     WHERE id = NEW.item_id AND clinic_id = NEW.clinic_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory_items no encontrado para item_id=% clinic_id=%',
      NEW.item_id, NEW.clinic_id;
  END IF;

  target_warehouse := NEW.warehouse_id;
  IF target_warehouse IS NULL THEN
    SELECT id INTO target_warehouse
      FROM public.warehouses
     WHERE clinic_id = NEW.clinic_id AND name = 'Bodega general'
     LIMIT 1;
  END IF;

  IF target_warehouse IS NOT NULL THEN
    INSERT INTO public.inventory_stock (clinic_id, item_id, warehouse_id, current_stock)
    VALUES (
      NEW.clinic_id, NEW.item_id, target_warehouse,
      CASE WHEN NEW.kind = 'salida' THEN 0 ELSE NEW.quantity END
    )
    ON CONFLICT (item_id, warehouse_id) DO UPDATE
      SET current_stock = CASE
            WHEN NEW.kind = 'entrada' THEN inventory_stock.current_stock + NEW.quantity
            WHEN NEW.kind = 'salida'  THEN GREATEST(0, inventory_stock.current_stock - NEW.quantity)
            ELSE NEW.quantity
          END,
          updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- ═══ 3 · ESTADOS DE CITA CONFIGURABLES ═══════════════════════════════════
-- El enum `appointment_status` de seis valores NO se toca: toda la lógica que
-- compara contra 'finalizada' o 'cancelada' sigue funcionando igual. Lo que se
-- agrega es una capa de vocabulario: la clínica define sus propias etiquetas
-- con color, y cada una mapea a uno de los seis canónicos.
--
-- Así se pueden tener "Confirmado por WhatsApp" y "Confirmado por email" como
-- dos estados distintos en pantalla, que para el sistema son el mismo
-- 'confirmada' y no rompen ningún filtro ni reporte existente.

CREATE TABLE public.appointment_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  label text NOT NULL,
  -- A cuál de los seis canónicos equivale. Es lo que hace que agregar
  -- etiquetas no rompa nada.
  canonical public.appointment_status NOT NULL,
  -- Hex de 6 dígitos. Se valida acá y no en la app para que ningún camino
  -- (import, API, script) meta un valor que después rompa el render.
  color text NOT NULL DEFAULT '#94a3b8' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  is_active boolean NOT NULL DEFAULT true,
  position smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, label)
);

CREATE INDEX appointment_statuses_clinic_idx
  ON public.appointment_statuses (clinic_id, is_active, position);
CREATE TRIGGER appointment_statuses_updated_at BEFORE UPDATE ON public.appointment_statuses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_statuses TO authenticated;
GRANT ALL ON public.appointment_statuses TO service_role;
ALTER TABLE public.appointment_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointment_statuses_select_members" ON public.appointment_statuses
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "appointment_statuses_write_managers" ON public.appointment_statuses
  FOR ALL TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));

ALTER TABLE public.appointments
  ADD COLUMN status_id uuid REFERENCES public.appointment_statuses(id) ON DELETE SET NULL;

CREATE INDEX appointments_status_id_idx
  ON public.appointments (clinic_id, status_id) WHERE status_id IS NOT NULL;

-- Siembra el vocabulario por defecto: los seis canónicos con su etiqueta
-- actual, más los cuatro que Dentalink distingue por canal y que Alika ya
-- puede alimentar (el canal está en `messages` desde agosto).
CREATE OR REPLACE FUNCTION public.seed_clinic_appointment_statuses()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.appointment_statuses (clinic_id, label, canonical, color, position)
  VALUES
    (NEW.id, 'Tentativa',                'tentativa',  '#94a3b8', 0),
    (NEW.id, 'Confirmada',               'confirmada', '#22c55e', 1),
    (NEW.id, 'Confirmada por WhatsApp',  'confirmada', '#16a34a', 2),
    (NEW.id, 'Confirmada por email',     'confirmada', '#0d9488', 3),
    (NEW.id, 'En sala de espera',        'en-sala',    '#3b82f6', 4),
    (NEW.id, 'Atendiéndose',             'en-sala',    '#2563eb', 5),
    (NEW.id, 'Finalizada',               'finalizada', '#0891b2', 6),
    (NEW.id, 'No asiste',                'ausente',    '#dc2626', 7),
    (NEW.id, 'Anulada',                  'cancelada',  '#737373', 8),
    (NEW.id, 'Anulada por el paciente',  'cancelada',  '#a3a3a3', 9)
  ON CONFLICT (clinic_id, label) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_clinic_created_appointment_statuses
  AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.seed_clinic_appointment_statuses();

INSERT INTO public.appointment_statuses (clinic_id, label, canonical, color, position)
SELECT c.id, v.label, v.canonical::public.appointment_status, v.color, v.position
FROM public.clinics c
CROSS JOIN (VALUES
  ('Tentativa',               'tentativa',  '#94a3b8', 0::smallint),
  ('Confirmada',              'confirmada', '#22c55e', 1::smallint),
  ('Confirmada por WhatsApp', 'confirmada', '#16a34a', 2::smallint),
  ('Confirmada por email',    'confirmada', '#0d9488', 3::smallint),
  ('En sala de espera',       'en-sala',    '#3b82f6', 4::smallint),
  ('Atendiéndose',            'en-sala',    '#2563eb', 5::smallint),
  ('Finalizada',              'finalizada', '#0891b2', 6::smallint),
  ('No asiste',               'ausente',    '#dc2626', 7::smallint),
  ('Anulada',                 'cancelada',  '#737373', 8::smallint),
  ('Anulada por el paciente', 'cancelada',  '#a3a3a3', 9::smallint)
) AS v(label, canonical, color, position)
ON CONFLICT (clinic_id, label) DO NOTHING;

-- ═══ 4 · FUSIÓN DE FICHAS DUPLICADAS ═════════════════════════════════════
-- Poco glamoroso y decisivo en la venta: toda clínica que migra de otro
-- sistema llega con el mismo paciente cargado tres veces. Si Alika no fusiona,
-- la limpieza es problema del cliente y el onboarding se muere ahí.

ALTER TABLE public.patients
  -- La ficha absorbida NO se borra: se marca. Borrarla perdería el rastro de
  -- que ese ID existió, y cualquier link viejo (un portal enviado por
  -- WhatsApp, un PDF con el número de ficha) quedaría apuntando a la nada.
  ADD COLUMN merged_into uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  ADD COLUMN merged_at timestamptz;

CREATE INDEX patients_merged_idx
  ON public.patients (clinic_id, merged_into) WHERE merged_into IS NOT NULL;

/**
 * Fusiona `source` dentro de `target`: reasigna todo lo que cuelga del
 * paciente y marca el origen como fusionado.
 *
 * SECURITY DEFINER porque toca ocho tablas con políticas distintas, pero
 * valida explícitamente que quien llama sea owner/admin de la clínica: sin ese
 * chequeo, cualquier miembro podría reasignar historias clínicas ajenas.
 *
 * Es una operación de una sola transacción a propósito. Si algo falla a mitad
 * de camino, el paciente quedaría con las citas movidas y las notas no — un
 * estado peor que no haber fusionado.
 */
CREATE OR REPLACE FUNCTION public.merge_patients(
  p_clinic_id uuid,
  p_source_id uuid,
  p_target_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_source_id = p_target_id THEN
    RAISE EXCEPTION 'No se puede fusionar una ficha consigo misma.';
  END IF;

  IF NOT public.has_clinic_role(
    p_clinic_id, ARRAY['owner','admin']::public.app_role[]
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para fusionar fichas.';
  END IF;

  -- Las dos fichas tienen que ser de la clínica que pide la fusión.
  IF NOT EXISTS (
    SELECT 1 FROM public.patients
     WHERE id = p_source_id AND clinic_id = p_clinic_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.patients
     WHERE id = p_target_id AND clinic_id = p_clinic_id
  ) THEN
    RAISE EXCEPTION 'Alguna de las dos fichas no pertenece a esta clínica.';
  END IF;

  UPDATE public.appointments        SET patient_id = p_target_id WHERE patient_id = p_source_id AND clinic_id = p_clinic_id;
  UPDATE public.payments            SET patient_id = p_target_id WHERE patient_id = p_source_id AND clinic_id = p_clinic_id;
  UPDATE public.quotes              SET patient_id = p_target_id WHERE patient_id = p_source_id AND clinic_id = p_clinic_id;
  UPDATE public.treatment_plans     SET patient_id = p_target_id WHERE patient_id = p_source_id AND clinic_id = p_clinic_id;
  UPDATE public.clinical_notes      SET patient_id = p_target_id WHERE patient_id = p_source_id AND clinic_id = p_clinic_id;
  UPDATE public.odontogram_marks    SET patient_id = p_target_id WHERE patient_id = p_source_id AND clinic_id = p_clinic_id;
  UPDATE public.periodontal_charts  SET patient_id = p_target_id WHERE patient_id = p_source_id AND clinic_id = p_clinic_id;
  UPDATE public.patient_documents   SET patient_id = p_target_id WHERE patient_id = p_source_id AND clinic_id = p_clinic_id;
  UPDATE public.patient_consents    SET patient_id = p_target_id WHERE patient_id = p_source_id AND clinic_id = p_clinic_id;
  UPDATE public.messages            SET patient_id = p_target_id WHERE patient_id = p_source_id AND clinic_id = p_clinic_id;
  UPDATE public.lab_orders          SET patient_id = p_target_id WHERE patient_id = p_source_id AND clinic_id = p_clinic_id;

  -- La historia médica NO se mueve: es una fila por paciente y fusionar dos
  -- anamnesis automáticamente inventaría un cuadro clínico que nadie revisó.
  -- Queda en la ficha origen, accesible, para que un profesional la mire.

  UPDATE public.patients
     SET merged_into = p_target_id,
         merged_at = now(),
         status = 'inactive'
   WHERE id = p_source_id AND clinic_id = p_clinic_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_patients(uuid, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.merge_patients(uuid, uuid, uuid) TO authenticated;

-- ═══ 5 · TIEMPOS REALES DE ATENCIÓN ══════════════════════════════════════
-- Prepara el panel de desempeño (Tanda D): sin la hora real de llegada no hay
-- "tiempo de espera" ni "atendidos vs. agendados" que no sea inventado.

ALTER TABLE public.appointments
  ADD COLUMN arrived_at timestamptz,
  ADD COLUMN started_at timestamptz;

COMMENT ON COLUMN public.appointments.arrived_at IS
  'Hora real de llegada del paciente. NULL = no se registró, no "llegó a horario".';
COMMENT ON COLUMN public.appointments.started_at IS
  'Hora real de inicio de la atención. La diferencia con arrived_at es la espera.';
