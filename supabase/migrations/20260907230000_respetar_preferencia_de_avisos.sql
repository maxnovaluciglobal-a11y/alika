-- El interruptor "Avisos dentro de Alika" pasa a hacer algo.
--
-- Hallazgo: `notification_preferences.inapp_enabled` sólo lo leía y escribía
-- su propia pantalla de preferencias. **Ningún camino lo consultaba antes de
-- insertar en `notifications`**, así que el switch que ve el usuario no hacía
-- absolutamente nada. La pantalla promete sin matices ("Campana de
-- notificaciones en tiempo real dentro de la aplicación"), y el usuario
-- conserva el canal de email, que se configura aparte — o sea que apagarlo
-- debe apagarlo de verdad, sin excepciones ocultas.
--
-- ⭐ Por qué va en la base y no en la app: la RLS de `notification_preferences`
-- es `user_id = auth.uid()`. Quien escribe una notificación para OTRA persona
-- **no puede leer la preferencia de esa persona** — es ilegible por diseño.
-- Un trigger SECURITY DEFINER es el único lugar donde el dato está disponible,
-- y de paso cubre los cuatro caminos que insertan hoy y los que vengan después
-- sin que nadie tenga que acordarse.
--
-- Semántica de opt-OUT: sin fila de preferencias se avisa. El default de la
-- app es `inappEnabled: true`, así que ausencia de fila y fila en true tienen
-- que comportarse igual; lo contrario dejaría sin avisos a todo el que nunca
-- entró a Preferencias.

CREATE OR REPLACE FUNCTION public.respetar_preferencia_de_avisos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.notification_preferences p
     WHERE p.user_id = NEW.recipient_id
       AND p.inapp_enabled = false
  ) THEN
    -- Descartar la fila es exactamente lo que pidió el usuario. No es un
    -- fallo silencioso: es la preferencia aplicándose.
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_respetar_preferencia ON public.notifications;
CREATE TRIGGER notifications_respetar_preferencia
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.respetar_preferencia_de_avisos();

COMMENT ON FUNCTION public.respetar_preferencia_de_avisos() IS
  'Descarta el aviso in-app cuando el destinatario lo apagó en Preferencias. Vive acá y no en la app porque la RLS de notification_preferences sólo deja leer la fila propia: quien escribe el aviso para otro no puede consultar su preferencia.';
