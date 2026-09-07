-- El total del ítem pasa a derivarse de las bodegas, en vez de mantenerse en
-- paralelo.
--
-- `apply_inventory_movement` escribía las dos vistas del stock con fórmulas
-- distintas y asimétricas:
--
--   total del ítem  ->  current_stock - quantity        (sin piso)
--   saldo de bodega ->  GREATEST(0, current_stock - q)  (clampeado a 0)
--
-- Una salida desde una bodega sin saldo suficiente restaba entera del total y
-- se quedaba en 0 en la bodega, y la diferencia se perdía sin error ni aviso.
-- Reproducido: entrada de 10 sin bodega (cae en la general) + salida de 2
-- desde una "Bodega B" vacía deja total = 8 contra una suma de bodegas = 10.
-- El diálogo de movimiento lo hace fácil de disparar sin darse cuenta, porque
-- muestra el stock total de la clínica mientras escribe sobre la bodega
-- elegida.
--
-- El `ajuste` rompía el mismo invariante en la otra dirección: fijaba el total
-- de la clínica Y el saldo de la bodega al mismo número, ignorando las demás
-- bodegas (general=10 + B=5, ajuste de 12 sobre B -> total=12, suma=22).
--
-- Criterio nuevo, decidido con el negocio antes de tocar el código:
--
--   1. El total del ítem NO se mantiene: se calcula como la suma de sus
--      bodegas al final de cada movimiento. Es lo que vuelve imposible el
--      descuadre — deja de haber dos verdades que hay que mantener de acuerdo.
--   2. Una salida sobre una bodega elegida por una persona que no tiene saldo
--      suficiente se RECHAZA (simétrico al CHECK que ya protege el total).
--   3. Una salida sin bodega —el consumo automático por procedimiento nunca
--      manda una, y tampoco la manda una clínica de una sola sede— se reparte
--      entre las bodegas con saldo en orden de posición. La general es
--      position 0, así que va primero y el caso de una sola bodega se comporta
--      exactamente igual que antes.
--
-- El rechazo sale con SQLSTATE 23514 a propósito: es el código que ya
-- interpretan `registerInventoryMovement` (mensaje al usuario) y
-- `consumirInsumos` (saltea ese insumo puntual y completa el tratamiento
-- igual, en vez de reventar). Cambiarlo rompería las dos.

CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bodega_destino uuid;
  nombre_destino text;
  saldo_destino numeric;
  restante numeric;
  a_descontar numeric;
  fila record;
BEGIN
  -- Serializa los movimientos del mismo ítem. Todo lo que sigue lee un saldo
  -- y escribe en función de lo leído; sin este lock dos salidas concurrentes
  -- pueden ver ambas saldo suficiente y dejar una bodega en negativo.
  -- De paso valida que el ítem sea de la clínica del movimiento.
  PERFORM 1 FROM public.inventory_items
   WHERE id = NEW.item_id AND clinic_id = NEW.clinic_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory_items no encontrado para item_id=% clinic_id=%',
      NEW.item_id, NEW.clinic_id;
  END IF;

  -- Un movimiento sin bodega cae en la general.
  bodega_destino := NEW.warehouse_id;
  IF bodega_destino IS NULL THEN
    SELECT id INTO bodega_destino
      FROM public.warehouses
     WHERE clinic_id = NEW.clinic_id AND name = 'Bodega general'
     LIMIT 1;
  ELSE
    -- La FK solo garantiza que la bodega existe, no que sea de esta clínica.
    PERFORM 1 FROM public.warehouses
     WHERE id = bodega_destino AND clinic_id = NEW.clinic_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La bodega elegida no pertenece a esta clínica.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.kind = 'entrada' THEN
    IF bodega_destino IS NULL THEN
      RAISE EXCEPTION 'La clínica no tiene ninguna bodega donde registrar el movimiento.'
        USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.inventory_stock (clinic_id, item_id, warehouse_id, current_stock)
    VALUES (NEW.clinic_id, NEW.item_id, bodega_destino, NEW.quantity)
    ON CONFLICT (item_id, warehouse_id) DO UPDATE
      SET current_stock = inventory_stock.current_stock + NEW.quantity,
          updated_at = now();

  ELSIF NEW.kind = 'ajuste' THEN
    -- El ajuste fija el saldo de UNA bodega (la elegida, o la general si el
    -- movimiento no trae ninguna). Ya no pisa el total de la clínica: ese sale
    -- de la suma, así que las otras bodegas conservan lo suyo. Para conciliar
    -- una clínica entera con varias bodegas está el conteo físico.
    IF bodega_destino IS NULL THEN
      RAISE EXCEPTION 'La clínica no tiene ninguna bodega donde registrar el movimiento.'
        USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.inventory_stock (clinic_id, item_id, warehouse_id, current_stock)
    VALUES (NEW.clinic_id, NEW.item_id, bodega_destino, NEW.quantity)
    ON CONFLICT (item_id, warehouse_id) DO UPDATE
      SET current_stock = NEW.quantity,
          updated_at = now();

  ELSIF NEW.kind = 'salida' THEN
    IF NEW.warehouse_id IS NOT NULL THEN
      -- Bodega elegida a mano: o alcanza, o la salida no ocurre. El descuento
      -- y la validación van en la misma sentencia para que el lock de fila
      -- haga el trabajo, en vez de un SELECT y después un UPDATE.
      UPDATE public.inventory_stock
         SET current_stock = current_stock - NEW.quantity,
             updated_at = now()
       WHERE item_id = NEW.item_id
         AND warehouse_id = NEW.warehouse_id
         AND current_stock >= NEW.quantity;
      IF NOT FOUND THEN
        SELECT w.name, COALESCE(s.current_stock, 0)
          INTO nombre_destino, saldo_destino
          FROM public.warehouses w
          LEFT JOIN public.inventory_stock s
            ON s.warehouse_id = w.id AND s.item_id = NEW.item_id
         WHERE w.id = NEW.warehouse_id;
        RAISE EXCEPTION
          'La bodega % tiene % y la salida pide %. Movés stock a esa bodega primero, o registrás la salida sin elegir bodega para que salga de donde haya.',
          COALESCE(nombre_destino, 'elegida'), COALESCE(saldo_destino, 0), NEW.quantity
          USING ERRCODE = '23514';
      END IF;
    ELSE
      -- Sin bodega elegida: se descuenta de las que tengan saldo, en orden de
      -- posición. El orden incluye created_at e id para que sea determinista
      -- aunque varias bodegas compartan position (el default es 0) — dos
      -- transacciones que recorren en el mismo orden no se traban entre sí.
      restante := NEW.quantity;
      FOR fila IN
        SELECT s.warehouse_id, s.current_stock
          FROM public.inventory_stock s
          JOIN public.warehouses w ON w.id = s.warehouse_id
         WHERE s.item_id = NEW.item_id
           AND s.clinic_id = NEW.clinic_id
           AND s.current_stock > 0
         ORDER BY w.position, w.created_at, w.id
      LOOP
        EXIT WHEN restante <= 0;
        a_descontar := LEAST(fila.current_stock, restante);
        UPDATE public.inventory_stock
           SET current_stock = current_stock - a_descontar,
               updated_at = now()
         WHERE item_id = NEW.item_id AND warehouse_id = fila.warehouse_id;
        restante := restante - a_descontar;
      END LOOP;
      IF restante > 0 THEN
        RAISE EXCEPTION
          'La salida pide % y la clínica tiene % en total.',
          NEW.quantity, NEW.quantity - restante
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  -- El invariante, garantizado por construcción y no por acuerdo entre tres
  -- fórmulas: el total del ítem es la suma de sus bodegas, siempre.
  UPDATE public.inventory_items
     SET current_stock = (
           SELECT COALESCE(SUM(current_stock), 0)
             FROM public.inventory_stock
            WHERE item_id = NEW.item_id
         )
   WHERE id = NEW.item_id AND clinic_id = NEW.clinic_id;

  RETURN NEW;
END;
$$;

-- ═══ Reparación de lo que el bug ya descuadró ════════════════════════════
-- La feature multi-bodega se mergeó el 06-sep, así que puede haber ítems con
-- el total por debajo de la suma de sus bodegas.
--
-- 1) Un ítem creado después del backfill original y nunca movido no tiene
--    fila en inventory_stock. Su stock se asigna entero a la bodega general,
--    mismo criterio que el backfill de 20260904160000: es la única
--    repartición honesta cuando nadie registró en qué bodega estaba.
INSERT INTO public.inventory_stock (clinic_id, item_id, warehouse_id, current_stock)
SELECT i.clinic_id, i.id, w.id, i.current_stock
FROM public.inventory_items i
JOIN public.warehouses w
  ON w.clinic_id = i.clinic_id AND w.name = 'Bodega general'
WHERE i.current_stock > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory_stock s WHERE s.item_id = i.id
  )
ON CONFLICT (item_id, warehouse_id) DO NOTHING;

-- 2) El total se recalcula desde las bodegas. Se elige la suma y no el total
--    porque la diferencia la produjo una salida que el sistema nunca debió
--    aceptar: la bodega no tenía con qué cubrirla. Si además hubo una salida
--    física real mal imputada, ninguna de las dos cifras la conoce y se
--    corrige con un conteo físico — pero al menos las dos vistas dejan de
--    contradecirse.
--    Solo para ítems que SÍ tienen bodegas: uno sin ninguna fila (clínica sin
--    bodega general) conserva su total en vez de irse a cero.
UPDATE public.inventory_items i
   SET current_stock = s.suma
  FROM (
    SELECT item_id, SUM(current_stock) AS suma
      FROM public.inventory_stock
     GROUP BY item_id
  ) s
 WHERE s.item_id = i.id
   AND i.current_stock IS DISTINCT FROM s.suma;
