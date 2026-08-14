-- Fase 6 · Tanda B.4 · Correlativo de presupuestos atómico
--
-- Antes: createQuote hacía count(*)+1 sobre quotes. Dos creaciones
-- concurrentes generaban el mismo número, colisionando en el UNIQUE
-- (clinic_id, number) y mostrando "duplicate key" al segundo usuario.
-- Además el año usaba tz del servidor (UTC en Vercel) — presupuestos
-- creados entre 21:00 y 23:59 del 31-dic en Chile llevaban prefijo
-- del año siguiente.
--
-- Ahora: tabla clinic_counters + función SECURITY DEFINER con
-- UPDATE ... RETURNING atómico. Reset por año.

CREATE TABLE public.clinic_counters (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  kind text NOT NULL,
  year integer NOT NULL,
  next_value integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, kind, year)
);

ALTER TABLE public.clinic_counters ENABLE ROW LEVEL SECURITY;
-- Nadie lee ni escribe directo desde authenticated; el acceso es solo
-- vía RPC SECURITY DEFINER que valida clinic membership.
GRANT SELECT ON public.clinic_counters TO authenticated;

CREATE POLICY "counters_select_members" ON public.clinic_counters
  FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));

CREATE OR REPLACE FUNCTION public.next_clinic_counter(
  p_clinic_id uuid,
  p_kind text,
  p_year integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
BEGIN
  -- Validar que el llamador es miembro de la clínica; SECURITY DEFINER
  -- bypasea RLS así que este chequeo es obligatorio.
  IF NOT public.is_clinic_member(p_clinic_id) THEN
    RAISE EXCEPTION 'No tienes permisos sobre esta clínica.';
  END IF;

  -- Atómico: intenta insertar con next_value=1 y devuelve 1; si ya existe,
  -- incrementa y devuelve el nuevo valor. ON CONFLICT ... DO UPDATE con
  -- RETURNING corre en un único statement sin race conditions.
  INSERT INTO public.clinic_counters (clinic_id, kind, year, next_value)
  VALUES (p_clinic_id, p_kind, p_year, 2)
  ON CONFLICT (clinic_id, kind, year)
  DO UPDATE SET
    next_value = clinic_counters.next_value + 1,
    updated_at = now()
  RETURNING next_value - 1 INTO v_next;

  RETURN v_next;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_clinic_counter(uuid, text, integer) TO authenticated;
