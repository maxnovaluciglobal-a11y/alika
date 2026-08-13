-- Fase 4A: mensajería (WhatsApp por link wa.me como primera pasada, tabla
-- diseñada para soportar SMS/email/API real en 4B sin migración adicional).

CREATE TYPE public.message_channel AS ENUM ('whatsapp', 'sms', 'email');
CREATE TYPE public.message_direction AS ENUM ('outbound', 'inbound');
CREATE TYPE public.message_status AS ENUM (
  'draft', 'queued', 'sent', 'delivered', 'read', 'failed'
);
CREATE TYPE public.message_template_kind AS ENUM (
  'appointment_reminder',
  'appointment_confirmation',
  'quote_sent',
  'payment_receipt',
  'nps_survey',
  'custom'
);

-- MESSAGE_TEMPLATES: catálogo por clínica. Los templates con variables
-- {nombre} {fecha} etc. se rellenan en el server al enviar. La primera
-- versión sembramos 3-4 defaults; se pueden editar desde la UI (fase 4B).
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  kind public.message_template_kind NOT NULL DEFAULT 'custom',
  name text NOT NULL,
  channel public.message_channel NOT NULL DEFAULT 'whatsapp',
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, kind, name)
);
CREATE INDEX message_templates_clinic_kind_idx ON public.message_templates (clinic_id, kind, is_active);
CREATE TRIGGER message_templates_updated_at BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "message_templates_select_members" ON public.message_templates
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "message_templates_write_managers" ON public.message_templates
  FOR ALL TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin']::public.app_role[]));

-- MESSAGES: historial de envíos y (a futuro) mensajes recibidos.
-- direction=outbound + status=sent cubre el caso wa.me (asumimos que si el
-- botón se apretó y el link se abrió, el usuario lo mandó); status='queued'/
-- 'delivered'/'read' se llenan cuando integremos API real con callbacks.
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  template_kind public.message_template_kind,
  channel public.message_channel NOT NULL DEFAULT 'whatsapp',
  direction public.message_direction NOT NULL DEFAULT 'outbound',
  status public.message_status NOT NULL DEFAULT 'sent',
  recipient text NOT NULL,
  body text NOT NULL,
  external_id text,
  error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_clinic_patient_idx ON public.messages (clinic_id, patient_id, created_at DESC);
CREATE INDEX messages_clinic_appointment_idx ON public.messages (clinic_id, appointment_id);
CREATE INDEX messages_clinic_date_idx ON public.messages (clinic_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select_members" ON public.messages
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "messages_write_operators" ON public.messages
  FOR ALL TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]));
