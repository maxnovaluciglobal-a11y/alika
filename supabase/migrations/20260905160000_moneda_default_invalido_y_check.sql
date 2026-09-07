-- Cierra la tensión que dejó `20260905120000`.
--
-- Ahí saqué el `DEFAULT 'CLP'` de las seis columnas de moneda para que un
-- trigger ausente fallara fuerte en vez de escribir Chile en silencio. El
-- efecto colateral aparece al generar los tipos con el CLI: el generador
-- marca una columna como opcional en `Insert` solo si tiene default o admite
-- nulos, y no tiene forma de saber que un trigger la llena. Sin default, los
-- tipos generados exigen `currency` en cada INSERT — justo el campo que el
-- código dejó de mandar a propósito. Seis errores de compilación.
--
-- La salida es un default que existe para que el generador lo vea y que
-- ninguna fila puede llegar a usar: `''` no pasa el CHECK. Así quedan
-- ciertas las tres cosas al mismo tiempo:
--
--   1. Los tipos generados marcan `currency?` y no hay nada que parchear.
--   2. El cliente sigue sin poder elegir la moneda: el trigger sobreescribe.
--   3. Si el trigger faltara, el INSERT revienta contra el CHECK.

-- El trigger normaliza a mayúsculas. `clinics.currency` es texto libre y una
-- clínica cargada como "clp" haría fallar el CHECK de todas las tablas hijas
-- sin que se entienda por qué.
CREATE OR REPLACE FUNCTION public.aplicar_moneda_de_la_clinica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moneda text;
BEGIN
  SELECT upper(btrim(c.currency)) INTO moneda
    FROM public.clinics c
   WHERE c.id = NEW.clinic_id;

  IF moneda IS NULL THEN
    RAISE EXCEPTION 'No existe la clínica % para resolver la moneda', NEW.clinic_id;
  END IF;

  NEW.currency := moneda;
  RETURN NEW;
END;
$$;

-- La clínica es el origen de todo esto, así que se valida ahí también.
UPDATE public.clinics SET currency = upper(btrim(currency)) WHERE currency <> upper(btrim(currency));

ALTER TABLE public.clinics DROP CONSTRAINT IF EXISTS clinics_moneda_iso;
ALTER TABLE public.clinics ADD CONSTRAINT clinics_moneda_iso
  CHECK (currency ~ '^[A-Z]{3}$');

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'expenses', 'lab_orders', 'payments', 'procedures', 'quotes', 'treatment_plans'
  ] LOOP
    -- Default deliberadamente inválido: está para que el generador de tipos
    -- marque la columna opcional, no para usarse. Cualquier fila que lo
    -- alcance es una fila cuyo trigger no corrió.
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN currency SET DEFAULT %L', t, '');
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_moneda_iso');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (currency ~ ''^[A-Z]{3}$'')',
      t, t || '_moneda_iso'
    );
  END LOOP;
END;
$$;
