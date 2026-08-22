-- security-6 Fase 1 (auditoría 360, cifrado de PII/PHI) — SOLO patients.document_id,
-- el campo de mayor sensibilidad (RUT/cédula/pasaporte) y menor superficie de uso
-- en el código. Ver docs/SECURITY6_CIFRADO_PLAN.md para el plan completo y por
-- qué NO se cifra patients entera de una.
--
-- ⚠️ ANTES de correr el resto de este archivo, generar la clave UNA VEZ en el
-- SQL Editor (reemplazar el comentario, no correrlo dos veces o se pierde
-- acceso a lo ya cifrado con la clave vieja):
--
--   select vault.create_secret(encode(gen_random_bytes(32),'hex'), 'alika_document_id_key');
--
-- Confirmar que quedó:
--   select name from vault.decrypted_secrets where name = 'alika_document_id_key';
--
-- Enfoque: cifrado (pgp_sym_encrypt, recuperable) + HMAC-SHA256 determinístico
-- como "blind index" para el dedup por igualdad que ya usa importPatients —
-- NO cifrado determinístico directo del valor (eso es vulnerable a análisis de
-- frecuencia si alguien tiene acceso de lectura a la tabla).
--
-- ESTRATEGIA DE ROLLOUT — doble escritura, sin cortar nada todavía:
-- `document_id` (texto plano) sigue existiendo y siendo la fuente de verdad
-- para lecturas/dedup HOY. Esta migración solo agrega las columnas nuevas y
-- las funciones para empezar a escribir en paralelo. El corte real (que la
-- app lea SOLO de document_id_enc y se borre el texto plano) es una fase
-- aparte, deliberadamente NO incluida acá — necesita validar primero que el
-- cifrado nuevo se está poblando bien antes de depender de él.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS document_id_enc bytea,
  ADD COLUMN IF NOT EXISTS document_id_hash text;

CREATE INDEX IF NOT EXISTS patients_document_id_hash_idx
  ON public.patients (clinic_id, document_id_hash);

COMMENT ON COLUMN public.patients.document_id_enc IS
  'RUT/cédula/pasaporte cifrado (pgp_sym_encrypt, clave en Vault). Fase 1 de security-6 — escritura en paralelo a document_id (texto plano), NO es todavía la fuente de verdad de lectura.';
COMMENT ON COLUMN public.patients.document_id_hash IS
  'HMAC-SHA256 de document_id normalizado (blind index) — permite dedup/búsqueda por igualdad sin exponer el valor cifrado a análisis de frecuencia.';

-- SECURITY DEFINER: authenticated no tiene (ni debe tener) permiso directo
-- de leer vault.decrypted_secrets — solo esta función, acotada a esta clave.
CREATE OR REPLACE FUNCTION public.set_patient_document_id(p_patient_id uuid, p_document_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_key text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.clinic_members m ON m.clinic_id = p.clinic_id
    WHERE p.id = p_patient_id AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para modificar este paciente.';
  END IF;

  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'alika_document_id_key';
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Falta la clave alika_document_id_key en Vault — generarla antes de usar esta función (ver comentario al inicio de esta migración).';
  END IF;

  UPDATE public.patients
  SET
    document_id_enc = CASE WHEN p_document_id IS NULL OR btrim(p_document_id) = '' THEN NULL
                            ELSE pgp_sym_encrypt(p_document_id, v_key) END,
    document_id_hash = CASE WHEN p_document_id IS NULL OR btrim(p_document_id) = '' THEN NULL
                             ELSE encode(hmac(lower(btrim(p_document_id)), v_key, 'sha256'), 'hex') END
  WHERE id = p_patient_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_patient_document_id(uuid, text) TO authenticated;

-- Lectura descifrada bajo demanda — NO se usa todavía desde el código de la
-- app (Fase 1 sigue leyendo del texto plano), queda lista para la Fase 1b.
CREATE OR REPLACE FUNCTION public.get_patient_document_id(p_patient_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_key text;
  v_enc bytea;
BEGIN
  SELECT p.document_id_enc INTO v_enc
  FROM public.patients p
  JOIN public.clinic_members m ON m.clinic_id = p.clinic_id
  WHERE p.id = p_patient_id AND m.user_id = auth.uid();

  IF v_enc IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'alika_document_id_key';
  RETURN pgp_sym_decrypt(v_enc, v_key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_document_id(uuid) TO authenticated;
-- Periodontograma: estándar clínico (AAP y equivalentes LatAm), a nivel PACIENTE.
-- Patrón de versionado: igual criterio que odontogram_marks/clinical_notes —
-- inmutable una vez creado. A diferencia del odontograma (que versiona por
-- SUPERFICIE individual con trigger de cierre), acá cada "sondaje" es un
-- EVENTO completo: una sesión de medición de toda la boca (o de las piezas
-- medidas ese día). No hace falta trigger de cierre porque no hay una fila
-- puntual que se reemplaza — un sondaje nuevo es simplemente un chart nuevo,
-- y "vigente" = el más reciente por paciente (ORDER BY recorded_at DESC LIMIT 1).
--
-- Simplificación documentada: profundidad de sondaje (PD), sangrado al
-- sondaje (BOP) y recesión gingival se registran los TRES por punto (6 puntos
-- por pieza: mv, v, dv, ml, l, dl) — el estándar real de la AAP, no una
-- reducción. Movilidad (Miller 0-3) y furca (0-3, solo molares) son por
-- PIEZA completa (no tiene sentido clínico medirlas por punto) y viven en
-- una fila aparte con point='whole' para esa pieza dentro del mismo chart.

CREATE TYPE public.periodontal_point AS ENUM ('mv', 'v', 'dv', 'ml', 'l', 'dl', 'whole');

-- PERIODONTAL_CHARTS: una fila = una sesión de sondaje completa.
CREATE TABLE public.periodontal_charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  notes text,
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX periodontal_charts_patient_idx
  ON public.periodontal_charts (clinic_id, patient_id, recorded_at DESC);

GRANT SELECT, INSERT ON public.periodontal_charts TO authenticated;
GRANT ALL ON public.periodontal_charts TO service_role;
ALTER TABLE public.periodontal_charts ENABLE ROW LEVEL SECURITY;

-- Mismo set que odontogram_select_clinical: clínico completo, no recepción.
CREATE POLICY "periodontal_charts_select_clinical" ON public.periodontal_charts
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist','assistant']::public.app_role[]
    )
  );

-- Mismo set que odontogram_insert_clinical: assistant ve pero no marca.
CREATE POLICY "periodontal_charts_insert_clinical" ON public.periodontal_charts
  FOR INSERT TO authenticated WITH CHECK (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist']::public.app_role[]
    )
    AND recorded_by = auth.uid()
  );

-- Sin UPDATE ni DELETE para `authenticated` — inmutable por diseño, mismo
-- criterio que security-1 (odontogram_marks/clinical_notes): la historia
-- clínica no se borra ni se corrige en duro, se corrige con un chart nuevo.
-- service_role conserva ALL (GRANT ALL arriba) para operaciones administrativas
-- (reset de la clínica demo, migraciones futuras) — ningún usuario de la app
-- recibe ese permiso.

-- PERIODONTAL_MEASUREMENTS: los puntos medidos dentro de un chart.
-- clinic_id se denormaliza acá (igual patrón que quote_items respecto de
-- quotes) para que la policy de RLS no dependa de un JOIN.
CREATE TABLE public.periodontal_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  chart_id uuid NOT NULL REFERENCES public.periodontal_charts(id) ON DELETE CASCADE,
  -- FDI ISO 3950, mismo rango que odontogram_marks: 11-48 permanentes, 51-85 primarios.
  tooth_number smallint NOT NULL,
  point public.periodontal_point NOT NULL,
  -- Profundidad de sondaje en mm. Rango razonable 0-15 (bolsas >15mm no son clínicamente plausibles).
  pocket_depth_mm smallint CHECK (pocket_depth_mm BETWEEN 0 AND 15),
  -- Sangrado al sondaje, por punto (los mismos 6 puntos que pocket_depth_mm).
  bleeding boolean,
  -- Recesión gingival en mm. Negativo = agrandamiento gingival, positivo = recesión.
  recession_mm smallint CHECK (recession_mm BETWEEN -10 AND 15),
  -- Solo tienen sentido en point='whole' (pieza completa, no por punto).
  mobility smallint CHECK (mobility BETWEEN 0 AND 3), -- escala de Miller
  furcation smallint CHECK (furcation BETWEEN 0 AND 3), -- solo molares
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT periodontal_tooth_range CHECK (
    (tooth_number BETWEEN 11 AND 18)
    OR (tooth_number BETWEEN 21 AND 28)
    OR (tooth_number BETWEEN 31 AND 38)
    OR (tooth_number BETWEEN 41 AND 48)
    OR (tooth_number BETWEEN 51 AND 55)
    OR (tooth_number BETWEEN 61 AND 65)
    OR (tooth_number BETWEEN 71 AND 75)
    OR (tooth_number BETWEEN 81 AND 85)
  ),
  -- Un punto no puede repetirse dos veces en el mismo chart para la misma pieza.
  CONSTRAINT periodontal_measurements_unique_point UNIQUE (chart_id, tooth_number, point)
);

CREATE INDEX periodontal_measurements_chart_idx
  ON public.periodontal_measurements (chart_id);
CREATE INDEX periodontal_measurements_clinic_idx
  ON public.periodontal_measurements (clinic_id, chart_id);

GRANT SELECT, INSERT ON public.periodontal_measurements TO authenticated;
GRANT ALL ON public.periodontal_measurements TO service_role;
ALTER TABLE public.periodontal_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "periodontal_measurements_select_clinical" ON public.periodontal_measurements
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist','assistant']::public.app_role[]
    )
  );

CREATE POLICY "periodontal_measurements_insert_clinical" ON public.periodontal_measurements
  FOR INSERT TO authenticated WITH CHECK (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist']::public.app_role[]
    )
  );

-- Sin UPDATE ni DELETE para `authenticated`, mismo criterio que arriba.
-- Módulo de inventario/control de stock a nivel clínica (no por paciente).
-- MVP: tracking simple de insumos/materiales, no un ERP.
--
-- Patrón: igual que odontogram_marks, NO hay UPDATE de movimientos ya
-- registrados. Un error se corrige con un movimiento de 'ajuste' nuevo,
-- nunca editando el viejo. `current_stock` en inventory_items se mantiene
-- vía trigger SECURITY DEFINER en cada INSERT de inventory_movements — la
-- app nunca escribe current_stock directamente.
--
-- Semántica de `kind` sobre current_stock (decisión de diseño, revisar):
--   entrada -> current_stock += quantity
--   salida  -> current_stock -= quantity (el CHECK current_stock >= 0 en
--              inventory_items revierte toda la transacción si no alcanza)
--   ajuste  -> current_stock := quantity (recuento físico: fija el valor
--              absoluto contado, no lo suma/resta). quantity siempre > 0
--              porque no existe "stock negativo".

CREATE TYPE public.inventory_movement_kind AS ENUM ('entrada', 'salida', 'ajuste');

CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  -- Unidad libre ("unidad"/"caja"/"ml"/etc) — sin catálogo de unidades, es MVP.
  unit text NOT NULL,
  current_stock numeric NOT NULL DEFAULT 0,
  -- null = "sin alerta configurada" (placeholder nullable, no fabricar 0).
  min_stock numeric,
  -- bigint cents, mismo patrón de dinero que el resto del repo. Nullable:
  -- no todos los ítems tienen costo cargado.
  cost_cents bigint,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_items_stock_non_negative CHECK (current_stock >= 0),
  CONSTRAINT inventory_items_min_stock_non_negative CHECK (min_stock IS NULL OR min_stock >= 0)
);

CREATE INDEX inventory_items_clinic_idx ON public.inventory_items (clinic_id, is_active, name);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- SELECT: información operativa, no clínica sensible — todos los roles
-- clínicos la ven (incluye reception, a diferencia de clinical_notes/odontogram).
CREATE POLICY "inventory_items_select_clinical" ON public.inventory_items
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist','assistant','reception']::public.app_role[]
    )
  );

-- INSERT/UPDATE (nombre, unit, min_stock, cost_cents, is_active — nunca
-- current_stock a mano, eso lo hace solo el trigger) restringido a
-- owner/admin.
CREATE POLICY "inventory_items_insert_managers" ON public.inventory_items
  FOR INSERT TO authenticated WITH CHECK (
    public.can_manage_clinic(clinic_id) AND created_by = auth.uid()
  );

CREATE POLICY "inventory_items_update_managers" ON public.inventory_items
  FOR UPDATE TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));

-- Sin DELETE para nadie: dar de baja un ítem es is_active=false, nunca
-- borrarlo (preserva el historial de movimientos).

CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  kind public.inventory_movement_kind NOT NULL,
  -- Siempre positivo — el signo/efecto sobre el stock lo da `kind`, ver
  -- comentario arriba.
  quantity numeric NOT NULL,
  -- ej. "compra", "uso en tratamiento", "merma", "conteo físico".
  reason text,
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX inventory_movements_item_idx
  ON public.inventory_movements (clinic_id, item_id, recorded_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- SELECT: mismo set que inventory_items.
CREATE POLICY "inventory_movements_select_clinical" ON public.inventory_movements
  FOR SELECT TO authenticated USING (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist','assistant','reception']::public.app_role[]
    )
  );

-- INSERT: solo roles que realmente tocan insumos en el día a día. reception
-- y accounting quedan afuera (criterio propio, revisar) — reception no
-- maneja materiales clínicos, accounting es de solo-lectura de finanzas.
CREATE POLICY "inventory_movements_insert_clinical" ON public.inventory_movements
  FOR INSERT TO authenticated WITH CHECK (
    public.has_clinic_role(
      clinic_id,
      ARRAY['owner','admin','dentist','assistant']::public.app_role[]
    )
    AND recorded_by = auth.uid()
  );

-- Nunca UPDATE ni DELETE por nadie — mismo patrón que
-- odontogram_no_manual_update. Un error se corrige con un 'ajuste' nuevo.
CREATE POLICY "inventory_movements_no_manual_update" ON public.inventory_movements
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "inventory_movements_no_delete" ON public.inventory_movements
  FOR DELETE TO authenticated USING (false);

-- Trigger: aplica el efecto del movimiento sobre current_stock. La app
-- nunca escribe inventory_items.current_stock directamente.
CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    RAISE EXCEPTION 'inventory_items no encontrado para item_id=% clinic_id=%', NEW.item_id, NEW.clinic_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER inventory_movements_apply_stock
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_inventory_movement();
