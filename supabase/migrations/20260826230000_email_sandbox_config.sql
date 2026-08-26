-- Unifica los dos gates de sandbox de email que estaban desconectados:
--   1) /sandbox-email guardaba la config en localStorage del navegador
--      (client-only, nunca llegaba al servidor).
--   2) email.server.ts gateaba el envío real con process.env.EMAIL_SANDBOX
--      (server-only, ignoraba toda la config rica de email-sandbox.ts).
-- Ahora la config vive en la DB por clínica: una sola fuente de verdad que
-- server (al enviar) y cliente (al configurar) comparten. La lógica de
-- decisión sigue siendo resolveEmailRecipient() en email-sandbox.ts.
--
-- Default seguro: sin fila = modo sandbox (nunca sale un email real por
-- accidente), igual que DEFAULT_EMAIL_SANDBOX en el código.

CREATE TABLE public.email_sandbox_config (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'sandbox' CHECK (mode IN ('sandbox', 'production')),
  redirect_to text NOT NULL DEFAULT '',
  allowlist text[] NOT NULL DEFAULT '{}',
  redirect_enabled boolean NOT NULL DEFAULT true,
  prefix_subject boolean NOT NULL DEFAULT true,
  min_entregas_produccion smallint NOT NULL DEFAULT 3
    CHECK (min_entregas_produccion BETWEEN 0 AND 50),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.email_sandbox_config TO authenticated;
GRANT ALL ON public.email_sandbox_config TO service_role;
ALTER TABLE public.email_sandbox_config ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier miembro de la clínica — al enviar un recordatorio por
-- email (recepción, dentista) hay que poder leer la config de sandbox para
-- decidir el destinatario, no solo los admins.
CREATE POLICY "email_sandbox_config_select" ON public.email_sandbox_config
  FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));

-- WRITE: solo owner/admin (mismo gate que las páginas /sandbox-email,
-- /dominio-email, /pruebas-email — permiso team:manage).
CREATE POLICY "email_sandbox_config_write" ON public.email_sandbox_config
  FOR ALL TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));
