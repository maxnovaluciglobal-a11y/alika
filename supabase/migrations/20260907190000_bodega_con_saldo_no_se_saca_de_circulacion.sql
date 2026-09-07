-- Una bodega con saldo no se borra ni se desactiva.
--
-- `20260907120000_stock_multibodega_no_descuadra` dejó el total del ítem
-- derivado de la suma de sus bodegas, calculado dentro de
-- `apply_inventory_movement`. El invariante
--
--     inventory_items.current_stock == SUM(inventory_stock.current_stock)
--
-- es imposible de romper POR UN MOVIMIENTO. Quedaban dos puertas fuera de esa
-- función, las dos alcanzables por API con la policy `warehouses_write_managers`
-- (es FOR ALL, así que un owner o admin puede hacer el DELETE sin pasar por la
-- UI, que hoy ni siquiera tiene el botón):
--
--   1. BORRAR. `inventory_stock.warehouse_id` es ON DELETE CASCADE: borrar la
--      bodega borra sus saldos, pero nadie recalcula el total del ítem. El
--      total queda por encima de la suma hasta el siguiente movimiento del
--      ítem, que lo baja de golpe. Las unidades desaparecen sin un movimiento
--      que las explique y sin ningún aviso.
--   2. DESACTIVAR. `listWarehouses` filtra por `is_active`, así que la bodega
--      sale del selector — pero su saldo sigue sumando al total y una salida
--      sin `warehouse_id` (el consumo automático por procedimiento nunca manda
--      una) la puede drenar igual, en orden de posición. No se pierden
--      unidades y el invariante se mantiene: lo que sorprende es que el insumo
--      salga de una bodega que la clínica dio por cerrada.
--
-- Decidido con el negocio: una sola regla para las dos puertas — con saldo
-- adentro, la bodega no sale de circulación. Primero se mueve el stock. Es la
-- opción que menos sorprende: nadie pierde unidades por una acción de
-- configuración, y no hace falta inventar una baja de inventario sin
-- movimiento que la respalde.
--
-- Lo que la regla NO toca, a propósito:
--   · renombrar, reordenar o reasignar la sucursal de una bodega con saldo;
--   · reactivar una bodega inactiva (es la salida de ese estado, no la entrada
--     — y puede haber bodegas inactivas con saldo desde antes de esta regla);
--   · borrar la clínica entera. `warehouses.clinic_id` es ON DELETE CASCADE:
--     si el bloqueo aplicara también ahí, una clínica con inventario sería
--     imposible de dar de baja. El trigger detecta ese caso porque para
--     cuando corre el DELETE en cascada la fila de `clinics` ya no existe.
--
-- El SQLSTATE es 23514, el mismo que ya usa `apply_inventory_movement` para
-- rechazar una salida sin saldo. Y el texto evita a propósito las palabras que
-- `mensajeDb` usa para descartar mensajes de base ("violates", "constraint",
-- "duplicate key", …): un mensaje que nombra la bodega y no llega a la
-- pantalla no sirve de nada.

CREATE OR REPLACE FUNCTION public.bloquear_bodega_con_saldo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accion text;
  insumos int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- El DELETE en cascada de una clínica ya borró la fila de `clinics` para
    -- cuando este trigger corre. Sin esta salida, dar de baja una clínica con
    -- inventario sería imposible.
    IF NOT EXISTS (SELECT 1 FROM public.clinics WHERE id = OLD.clinic_id) THEN
      RETURN OLD;
    END IF;
    accion := 'borrarla';
  ELSE
    -- Solo el paso de activa a inactiva. Renombrar, reordenar, cambiar de
    -- sucursal o reactivar no sacan la bodega de circulación.
    IF NOT (OLD.is_active AND NOT NEW.is_active) THEN
      RETURN NEW;
    END IF;
    accion := 'desactivarla';
  END IF;

  SELECT count(*) INTO insumos
    FROM public.inventory_stock
   WHERE warehouse_id = OLD.id
     AND current_stock > 0;

  IF insumos > 0 THEN
    RAISE EXCEPTION
      'La bodega "%" todavía tiene stock de % insumo(s). Movés ese stock a otra bodega y después podés %.',
      OLD.name, insumos, accion
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS warehouses_no_sacar_con_saldo ON public.warehouses;
CREATE TRIGGER warehouses_no_sacar_con_saldo
  BEFORE DELETE OR UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_bodega_con_saldo();
