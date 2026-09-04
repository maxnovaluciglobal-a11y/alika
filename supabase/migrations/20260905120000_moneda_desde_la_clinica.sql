-- La moneda de una fila la decide la clínica, no el navegador.
--
-- Toda la cadena de escritura mandaba `"CLP"` literal desde el cliente
-- (`createQuote`, `registerPayment`, `createExpense`, `createProcedure`,
-- `createLabOrder`) mientras la UI formateaba con `access.clinic.currency`.
-- Hoy es inofensivo porque las seis clínicas son CLP; en una clínica en MXN
-- la misma pantalla mostraría `$5.000,00` de un lado y `$500.000` del otro.
--
-- El arreglo no es un DEFAULT. Un DEFAULT solo aplica si el cliente OMITE la
-- columna: si la manda, gana el cliente. Es el mismo hueco que la auditoría
-- del 04-sep encontró en `created_by` (hallazgo P3). Un trigger BEFORE INSERT
-- que sobreescribe siempre hace que la moneda equivocada sea imposible.
--
-- Solo INSERT, nunca UPDATE: un presupuesto se cotizó en la moneda de su
-- momento. Si la clínica cambia de moneda, el histórico no se reescribe.

CREATE OR REPLACE FUNCTION public.aplicar_moneda_de_la_clinica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moneda text;
BEGIN
  SELECT c.currency INTO moneda
    FROM public.clinics c
   WHERE c.id = NEW.clinic_id;

  -- Sin clínica no hay fila válida: la FK lo rechaza igual un instante
  -- después, pero fallar acá deja un mensaje que se entiende.
  IF moneda IS NULL THEN
    RAISE EXCEPTION 'No existe la clínica % para resolver la moneda', NEW.clinic_id;
  END IF;

  NEW.currency := moneda;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.aplicar_moneda_de_la_clinica() IS
  'BEFORE INSERT: fija currency desde clinics.currency, ignorando lo que mande el cliente.';

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'expenses', 'lab_orders', 'payments', 'procedures', 'quotes', 'treatment_plans'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS moneda_desde_la_clinica ON public.%I', t
    );
    EXECUTE format(
      'CREATE TRIGGER moneda_desde_la_clinica
         BEFORE INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.aplicar_moneda_de_la_clinica()', t
    );
  END LOOP;
END;
$$;

-- Alineación puntual de lo que ya existe. Hoy es un no-op —las seis clínicas
-- son CLP y las diez filas de dinero también— pero deja el invariante cierto
-- desde el minuto cero en cualquier entorno, no solo en este.
UPDATE public.expenses e
   SET currency = c.currency
  FROM public.clinics c
 WHERE c.id = e.clinic_id AND e.currency <> c.currency;

UPDATE public.lab_orders l
   SET currency = c.currency
  FROM public.clinics c
 WHERE c.id = l.clinic_id AND l.currency <> c.currency;

UPDATE public.payments p
   SET currency = c.currency
  FROM public.clinics c
 WHERE c.id = p.clinic_id AND p.currency <> c.currency;

UPDATE public.procedures pr
   SET currency = c.currency
  FROM public.clinics c
 WHERE c.id = pr.clinic_id AND pr.currency <> c.currency;

UPDATE public.quotes q
   SET currency = c.currency
  FROM public.clinics c
 WHERE c.id = q.clinic_id AND q.currency <> c.currency;

UPDATE public.treatment_plans tp
   SET currency = c.currency
  FROM public.clinics c
 WHERE c.id = tp.clinic_id AND tp.currency <> c.currency;

-- Y se retira el último rastro de "asumir Chile" que quedaba en la base.
--
-- Con el trigger puesto, `DEFAULT 'CLP'` ya no se usa nunca: la columna se
-- llena antes de que el default pueda aplicar. Dejarlo ahí sería una red de
-- contención que convierte un trigger caído en filas silenciosamente
-- marcadas como pesos chilenos — exactamente el bug que esta migración
-- existe para cerrar. Sin default, si el trigger falta el INSERT revienta
-- contra el NOT NULL y alguien se entera.
ALTER TABLE public.expenses        ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE public.lab_orders      ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE public.payments        ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE public.procedures      ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE public.quotes          ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE public.treatment_plans ALTER COLUMN currency DROP DEFAULT;
