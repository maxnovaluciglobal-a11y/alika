-- Fase 3 (WhatsApp — captación): tabla whatsapp_leads.
--
-- Contexto: el webhook (api.whatsapp-webhook.ts) hoy descarta en silencio
-- cualquier mensaje entrante de un número que no coincide con ningún
-- paciente de la clínica (`if (!patient) return;`). Eso es exactamente el
-- caso de un desconocido que escribe por primera vez — el escenario que más
-- importa para "captación" (QR, bio de Instagram, Click-to-WhatsApp ads).
-- No se reusa `waitlist_entries`: esa tabla significa "esperando un turno",
-- y un mensaje entrante puede ser cualquier cosa (consulta, urgencia, spam).
-- No se reusa `messages`: su FK a patient_id es NOT NULL, no puede
-- representar a alguien sin ficha.

CREATE TYPE public.whatsapp_lead_status AS ENUM ('new', 'contacted', 'converted', 'discarded');

CREATE TABLE public.whatsapp_leads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  phone             text NOT NULL,       -- normalizado (normalizeToWaMe), sin '+' ni espacios
  name              text,                -- del perfil de WhatsApp si Meta lo manda; puede faltar
  first_message     text NOT NULL,
  status            public.whatsapp_lead_status NOT NULL DEFAULT 'new',
  auto_replied_at   timestamptz,         -- null = todavía no se le mandó la auto-respuesta
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, phone)              -- upsert: un desconocido que escribe varias veces es UN lead, no varios
);
CREATE INDEX whatsapp_leads_clinic_status_idx ON public.whatsapp_leads (clinic_id, status, created_at DESC);
CREATE TRIGGER whatsapp_leads_updated_at BEFORE UPDATE ON public.whatsapp_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_leads TO authenticated;
GRANT ALL ON public.whatsapp_leads TO service_role;
ALTER TABLE public.whatsapp_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_leads_select_members" ON public.whatsapp_leads
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "whatsapp_leads_write_agenda_roles" ON public.whatsapp_leads
  FOR ALL TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]))
  WITH CHECK (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','reception']::public.app_role[]));
