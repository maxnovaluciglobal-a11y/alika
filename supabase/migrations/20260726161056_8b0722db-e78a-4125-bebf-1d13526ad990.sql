CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL,
  actor_id uuid,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  note_id uuid REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  patient_ref text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver mis notificaciones" ON public.notifications
FOR SELECT TO authenticated
USING (recipient_id = auth.uid());

CREATE POLICY "Crear notificaciones dentro de mi clinica" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (public.is_clinic_member(clinic_id) AND actor_id = auth.uid());

CREATE POLICY "Actualizar mis notificaciones" ON public.notifications
FOR UPDATE TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "Borrar mis notificaciones" ON public.notifications
FOR DELETE TO authenticated
USING (recipient_id = auth.uid());

CREATE INDEX notifications_recipient_idx ON public.notifications (recipient_id, read_at, created_at DESC);

CREATE TRIGGER notifications_set_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;