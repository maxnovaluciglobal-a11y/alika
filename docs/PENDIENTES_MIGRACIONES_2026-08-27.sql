-- ===== supabase/migrations/20260827000000_f1_f3_f4_comunicaciones_fix.sql =====
-- Auditoría 360 v2 (26-ago-2026), área Comunicaciones — F1 + F3 + F4.
--
-- F1: el botón "Email" del aviso de 3h en /recordatorios siempre fallaba
-- porque nunca se sembró el template email de appointment_checkin.
-- F3: quote_sent y payment_receipt eran WhatsApp-only, sin fallback a email.
-- F4: el copy sembrado por handle_new_clinic() usa voseo rioplatense
-- ("respondé", "avisanos", "podés") en TODAS las clínicas, incluidas las de
-- México/Colombia/Perú (target explícito de CLAUDE.md) — se neutraliza acá
-- el copy completo, no solo los templates nuevos.
--
-- Nota: F1 y F3 ya se aplicaron como dato en vivo (script puntual con
-- service_role) el 2026-08-26 para las clínicas existentes en ese momento —
-- esta migración deja lo mismo versionado en el historial, lo aplica a
-- handle_new_clinic() para clínicas NUEVAS, y agrega el fix F4 de copy que
-- el script puntual no incluía.

CREATE OR REPLACE FUNCTION public.handle_new_clinic()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.clinic_members (clinic_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.message_templates (clinic_id, kind, name, channel, subject, body, created_by)
  VALUES
    (NEW.id, 'appointment_reminder', 'Recordatorio 48h antes', 'whatsapp', NULL,
     'Hola {paciente}, te recordamos tu cita de {tratamiento} el {fecha_larga} a las {hora}. Para confirmar responde SÍ, o RE para reagendar. Nos vemos en {clinica}. 🦷',
     NEW.created_by),
    (NEW.id, 'appointment_checkin', 'Aviso 3h antes', 'whatsapp', NULL,
     'Hola {paciente}, en unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos! Si no puedes venir, avísanos por acá.',
     NEW.created_by),
    (NEW.id, 'appointment_confirmation', 'Confirmación de cita nueva', 'whatsapp', NULL,
     'Hola {paciente}, tu cita quedó agendada: {tratamiento} el {fecha_larga} a las {hora} con {profesional}. Cualquier cambio, avísanos por acá. — {clinica}',
     NEW.created_by),
    (NEW.id, 'quote_sent', 'Envío de presupuesto', 'whatsapp', NULL,
     'Hola {paciente}, te compartimos el presupuesto {numero_presupuesto} por {total}. Cualquier duda, dinos y coordinamos cuando quieras arrancar. — {clinica}',
     NEW.created_by),
    (NEW.id, 'payment_receipt', 'Recibo de pago', 'whatsapp', NULL,
     'Hola {paciente}, recibimos tu pago de {monto} el {fecha}. Saldo pendiente: {saldo}. ¡Gracias! — {clinica}',
     NEW.created_by),
    (NEW.id, 'appointment_confirmation', 'Confirmación de cita (email)', 'email',
     'Tu cita en {clinica} quedó confirmada',
     '<p>Hola {paciente},</p><p>Tu cita quedó agendada:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li><li><strong>Profesional:</strong> {profesional}</li></ul><p>Cualquier cambio, responde este correo o escríbenos por WhatsApp.</p><p>— {clinica}</p>',
     NEW.created_by),
    (NEW.id, 'appointment_reminder', 'Recordatorio de cita (email)', 'email',
     'Recordatorio: tu cita en {clinica} es el {fecha_larga}',
     '<p>Hola {paciente},</p><p>Te recordamos tu cita:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li></ul><p>Si necesitas reagendar, escríbenos por WhatsApp o responde este correo.</p><p>— {clinica}</p>',
     NEW.created_by),
    (NEW.id, 'nps_survey', 'Encuesta de satisfacción', 'whatsapp', NULL,
     'Hola {paciente}, ¿cómo fue tu experiencia con {tratamiento} en {clinica}? Responde con una nota del 1 al 10 (10 = excelente) y cuéntanos qué mejorarías. ¡Gracias por ayudarnos a mejorar! 🙏',
     NEW.created_by),
    (NEW.id, 'nps_survey', 'Encuesta de satisfacción (email)', 'email',
     '¿Cómo fue tu experiencia en {clinica}?',
     '<p>Hola {paciente},</p><p>Queremos saber cómo fue tu experiencia con <strong>{tratamiento}</strong> en {clinica}.</p><p>Responde este correo con una nota del <strong>1 al 10</strong> (10 = excelente) y, si quieres, cuéntanos qué mejorarías.</p><p>¡Gracias por ayudarnos a mejorar!</p><p>— {clinica}</p>',
     NEW.created_by),
    -- F1: template de email para appointment_checkin, nunca sembrado hasta ahora.
    (NEW.id, 'appointment_checkin', 'Aviso 3h antes (email)', 'email',
     'En unas horas tenés tu cita en {clinica}',
     '<p>Hola {paciente},</p><p>En unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos!</p><p>Si no puedes venir, escríbenos por WhatsApp o responde este correo.</p><p>— {clinica}</p>',
     NEW.created_by),
    -- F3: fallback de email para presupuesto y recibo de pago (antes WhatsApp-only).
    (NEW.id, 'quote_sent', 'Envío de presupuesto (email)', 'email',
     'Tu presupuesto de {clinica}',
     '<p>Hola {paciente},</p><p>Te compartimos el presupuesto <strong>{numero_presupuesto}</strong> por <strong>{total}</strong>.</p><p>Cualquier duda, responde este correo o escríbenos por WhatsApp y coordinamos cuando quieras arrancar.</p><p>— {clinica}</p>',
     NEW.created_by),
    (NEW.id, 'payment_receipt', 'Recibo de pago (email)', 'email',
     'Recibimos tu pago — {clinica}',
     '<p>Hola {paciente},</p><p>Recibimos tu pago de <strong>{monto}</strong> el {fecha}.</p><p>Saldo pendiente: {saldo}.</p><p>¡Gracias!</p><p>— {clinica}</p>',
     NEW.created_by)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

-- F1/F3 backfill para clínicas ya existentes — idempotente, ya aplicado en
-- vivo el 2026-08-26 vía script puntual con service_role; queda acá versionado.
INSERT INTO public.message_templates (clinic_id, kind, name, channel, subject, body, created_by)
SELECT c.id, 'appointment_checkin', 'Aviso 3h antes (email)', 'email',
       'En unas horas tenés tu cita en {clinica}',
       '<p>Hola {paciente},</p><p>En unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos!</p><p>Si no puedes venir, escríbenos por WhatsApp o responde este correo.</p><p>— {clinica}</p>',
       c.created_by
FROM public.clinics c
ON CONFLICT DO NOTHING;

INSERT INTO public.message_templates (clinic_id, kind, name, channel, subject, body, created_by)
SELECT c.id, 'quote_sent', 'Envío de presupuesto (email)', 'email',
       'Tu presupuesto de {clinica}',
       '<p>Hola {paciente},</p><p>Te compartimos el presupuesto <strong>{numero_presupuesto}</strong> por <strong>{total}</strong>.</p><p>Cualquier duda, responde este correo o escríbenos por WhatsApp y coordinamos cuando quieras arrancar.</p><p>— {clinica}</p>',
       c.created_by
FROM public.clinics c
ON CONFLICT DO NOTHING;

INSERT INTO public.message_templates (clinic_id, kind, name, channel, subject, body, created_by)
SELECT c.id, 'payment_receipt', 'Recibo de pago (email)', 'email',
       'Recibimos tu pago — {clinica}',
       '<p>Hola {paciente},</p><p>Recibimos tu pago de <strong>{monto}</strong> el {fecha}.</p><p>Saldo pendiente: {saldo}.</p><p>¡Gracias!</p><p>— {clinica}</p>',
       c.created_by
FROM public.clinics c
ON CONFLICT DO NOTHING;

-- F4: neutralizar el copy voseante ya sembrado en clínicas existentes
-- (match exacto de body para no tocar nada editado a mano por una clínica).
UPDATE public.message_templates SET body =
  'Hola {paciente}, te recordamos tu cita de {tratamiento} el {fecha_larga} a las {hora}. Para confirmar responde SÍ, o RE para reagendar. Nos vemos en {clinica}. 🦷'
WHERE kind = 'appointment_reminder' AND channel = 'whatsapp' AND body =
  'Hola {paciente}, te recordamos tu cita de {tratamiento} el {fecha_larga} a las {hora}. Para confirmar respondé SÍ, o RE para reagendar. Nos vemos en {clinica}. 🦷';

UPDATE public.message_templates SET body =
  'Hola {paciente}, en unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos! Si no puedes venir, avísanos por acá.'
WHERE kind = 'appointment_checkin' AND channel = 'whatsapp' AND body =
  'Hola {paciente}, en unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos! Si no podés venir, avisanos por acá.';

UPDATE public.message_templates SET body =
  'Hola {paciente}, tu cita quedó agendada: {tratamiento} el {fecha_larga} a las {hora} con {profesional}. Cualquier cambio, avísanos por acá. — {clinica}'
WHERE kind = 'appointment_confirmation' AND channel = 'whatsapp' AND body =
  'Hola {paciente}, tu cita quedó agendada: {tratamiento} el {fecha_larga} a las {hora} con {profesional}. Cualquier cambio nos avisás por acá. — {clinica}';

UPDATE public.message_templates SET body =
  'Hola {paciente}, te compartimos el presupuesto {numero_presupuesto} por {total}. Cualquier duda, dinos y coordinamos cuando quieras arrancar. — {clinica}'
WHERE kind = 'quote_sent' AND channel = 'whatsapp' AND body =
  'Hola {paciente}, te comparto el presupuesto {numero_presupuesto} por {total}. Cualquier duda me decís y coordinamos cuando quieras arrancar. — {clinica}';

UPDATE public.message_templates SET body =
  '<p>Hola {paciente},</p><p>Tu cita quedó agendada:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li><li><strong>Profesional:</strong> {profesional}</li></ul><p>Cualquier cambio, responde este correo o escríbenos por WhatsApp.</p><p>— {clinica}</p>'
WHERE kind = 'appointment_confirmation' AND channel = 'email' AND body =
  '<p>Hola {paciente},</p><p>Tu cita quedó agendada:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li><li><strong>Profesional:</strong> {profesional}</li></ul><p>Cualquier cambio, respondé este correo o escribinos por WhatsApp.</p><p>— {clinica}</p>';

UPDATE public.message_templates SET body =
  '<p>Hola {paciente},</p><p>Te recordamos tu cita:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li></ul><p>Si necesitas reagendar, escríbenos por WhatsApp o responde este correo.</p><p>— {clinica}</p>'
WHERE kind = 'appointment_reminder' AND channel = 'email' AND body =
  '<p>Hola {paciente},</p><p>Te recordamos tu cita:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li></ul><p>Si necesitás reagendar, escribinos por WhatsApp o respondé este correo.</p><p>— {clinica}</p>';

UPDATE public.message_templates SET body =
  'Hola {paciente}, ¿cómo fue tu experiencia con {tratamiento} en {clinica}? Responde con una nota del 1 al 10 (10 = excelente) y cuéntanos qué mejorarías. ¡Gracias por ayudarnos a mejorar! 🙏'
WHERE kind = 'nps_survey' AND channel = 'whatsapp' AND body =
  'Hola {paciente}, ¿cómo fue tu experiencia con {tratamiento} en {clinica}? Respondé con una nota del 1 al 10 (10 = excelente) y contanos qué mejorarías. ¡Gracias por ayudarnos a mejorar! 🙏';

UPDATE public.message_templates SET body =
  '<p>Hola {paciente},</p><p>Queremos saber cómo fue tu experiencia con <strong>{tratamiento}</strong> en {clinica}.</p><p>Responde este correo con una nota del <strong>1 al 10</strong> (10 = excelente) y, si quieres, cuéntanos qué mejorarías.</p><p>¡Gracias por ayudarnos a mejorar!</p><p>— {clinica}</p>'
WHERE kind = 'nps_survey' AND channel = 'email' AND body =
  '<p>Hola {paciente},</p><p>Queremos saber cómo fue tu experiencia con <strong>{tratamiento}</strong> en {clinica}.</p><p>Respondé este correo con una nota del <strong>1 al 10</strong> (10 = excelente) y, si querés, contanos qué mejorarías.</p><p>¡Gracias por ayudarnos a mejorar!</p><p>— {clinica}</p>';

-- F4: los 3 templates de email sembrados en vivo el 2026-08-26 (F1/F3) también
-- tenían voseo en el copy original del script puntual — corregidos acá.
UPDATE public.message_templates SET body =
  '<p>Hola {paciente},</p><p>En unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos!</p><p>Si no puedes venir, escríbenos por WhatsApp o responde este correo.</p><p>— {clinica}</p>'
WHERE kind = 'appointment_checkin' AND channel = 'email' AND name = 'Aviso 3h antes (email)' AND body =
  '<p>Hola {paciente},</p><p>En unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos!</p><p>Si no podés venir, escribinos por WhatsApp o respondé este correo.</p><p>— {clinica}</p>';

UPDATE public.message_templates SET body =
  '<p>Hola {paciente},</p><p>Te compartimos el presupuesto <strong>{numero_presupuesto}</strong> por <strong>{total}</strong>.</p><p>Cualquier duda, responde este correo o escríbenos por WhatsApp y coordinamos cuando quieras arrancar.</p><p>— {clinica}</p>'
WHERE kind = 'quote_sent' AND channel = 'email' AND name = 'Envío de presupuesto (email)' AND body =
  '<p>Hola {paciente},</p><p>Te compartimos el presupuesto <strong>{numero_presupuesto}</strong> por <strong>{total}</strong>.</p><p>Cualquier duda, respondé este correo o escribinos por WhatsApp y coordinamos cuando quieras arrancar.</p><p>— {clinica}</p>';


-- ===== supabase/migrations/20260827010000_medical_history_audit_trail.sql =====
-- Auditoría 360 v2 (26-ago-2026) — seguridad-3 / arq-5: "anamnesis con
-- alergias mutable sin historial, inconsistente con el versionado que el
-- resto del sistema clínico exige".
--
-- Decisión de diseño (revisar con Walter si se prefiere lo contrario):
-- `patient_medical_history` fue creada A PROPÓSITO como "1 fila por
-- paciente... no versionada como clinical_notes/odontogram_marks: es un
-- perfil editable, no un evento clínico" (ver comentario original en
-- 20260826180000_patient_medical_history.sql). Convertirla al patrón
-- INSERT-nueva-versión de odontogram_marks/clinical_notes cambiaría esa
-- decisión de diseño y obligaría a reescribir todo lector de "alergias
-- vigentes" del repo (agenda, ficha de paciente, futuro banner de agenda).
--
-- En vez de eso, se agrega una AUDITORÍA (append-only, nunca se lee para
-- mostrar el dato vigente) que resuelve el riesgo real señalado por la
-- auditoría — perder sin rastro el valor anterior de una alergia — sin
-- tocar ningún código existente que lee `patient_medical_history`.

CREATE TABLE public.patient_medical_history_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- Snapshot completo de la fila ANTES del cambio (o del alta, ver trigger).
  allergies text[] NOT NULL,
  chronic_medications text[] NOT NULL,
  conditions text[] NOT NULL,
  notes text,
  changed_by uuid,
  change_kind text NOT NULL CHECK (change_kind IN ('insert', 'update')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_medical_history_audit_patient_idx
  ON public.patient_medical_history_audit (patient_id, recorded_at DESC);

GRANT SELECT, INSERT ON public.patient_medical_history_audit TO authenticated;
GRANT ALL ON public.patient_medical_history_audit TO service_role;
ALTER TABLE public.patient_medical_history_audit ENABLE ROW LEVEL SECURITY;

-- Mismo set de roles que la tabla que audita (regla #2 CLAUDE.md).
CREATE POLICY "medical_history_audit_select_clinical" ON public.patient_medical_history_audit
  FOR SELECT TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','dentist','assistant']::public.app_role[]));

-- Nunca UPDATE/DELETE sobre la auditoría misma — es append-only por diseño,
-- mismo criterio que security-1 de la auditoría del 21-ago (no revocar sin
-- revisión explícita).
REVOKE UPDATE, DELETE ON public.patient_medical_history_audit FROM authenticated;

CREATE OR REPLACE FUNCTION public.log_patient_medical_history_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.patient_medical_history_audit
      (clinic_id, patient_id, allergies, chronic_medications, conditions, notes, changed_by, change_kind)
    VALUES
      (NEW.clinic_id, NEW.patient_id, NEW.allergies, NEW.chronic_medications, NEW.conditions, NEW.notes,
       NEW.updated_by, 'insert');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Guarda el estado ANTERIOR (OLD), no el nuevo — el nuevo ya queda en
    -- patient_medical_history. Esto es lo que responde "¿qué decía antes
    -- de este cambio?" ante una disputa o un error de tipeo.
    INSERT INTO public.patient_medical_history_audit
      (clinic_id, patient_id, allergies, chronic_medications, conditions, notes, changed_by, change_kind)
    VALUES
      (OLD.clinic_id, OLD.patient_id, OLD.allergies, OLD.chronic_medications, OLD.conditions, OLD.notes,
       NEW.updated_by, 'update');
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER patient_medical_history_audit_trigger
  AFTER INSERT OR UPDATE ON public.patient_medical_history
  FOR EACH ROW EXECUTE FUNCTION public.log_patient_medical_history_change();


-- ===== supabase/migrations/20260827020000_commission_settlements.sql =====
-- Auditoría 360 v2 (26-ago-2026) — arq-1 + arq-8 + ops-3 + ops-9:
-- `getCommissionReport` recalcula siempre sobre `commission_rules` vigente
-- HOY, sin ningún estado de "período cerrado" — correr el reporte dos veces
-- en el mismo mes (o editar una regla después) puede dar montos distintos
-- para el mismo período ya comunicado/pagado a un profesional.
--
-- Fix: al "cerrar" un período, se congela un snapshot por profesional
-- (regla usada + montos calculados) en esta tabla. `getCommissionReport`
-- sigue calculando en vivo para cualquier rango que NO tenga settlement
-- (el período abierto actual), pero un período ya cerrado nunca vuelve a
-- recalcularse aunque cambie `commission_rules` después — resuelve arq-1/
-- arq-8/ops-9 sin necesitar vigencia temporal en `commission_rules` (que
-- hubiera exigido rediseñar su PK actual de "una fila por profesional").
-- También agrega `paid_at` (ops-3: hoy no hay forma de marcar "ya pagado").

CREATE TABLE public.commission_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  period_from date NOT NULL,
  period_to date NOT NULL,
  -- Snapshot de la regla usada al momento del cierre (no FK viva a
  -- commission_rules — si esa fila se edita o borra después, esto no cambia).
  rule_kind text NOT NULL CHECK (rule_kind IN ('percent', 'fixed')),
  rule_percent_bps integer NOT NULL DEFAULT 0,
  rule_fixed_cents bigint NOT NULL DEFAULT 0,
  production_cents bigint NOT NULL,
  procedure_count integer NOT NULL,
  commission_cents bigint NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid NOT NULL,
  paid_at timestamptz,
  paid_by uuid,
  -- Un profesional no puede tener 2 cierres para el mismo período exacto
  -- (evita duplicar/pagar dos veces el mismo rango por error).
  UNIQUE (clinic_id, professional_id, period_from, period_to)
);
CREATE INDEX commission_settlements_clinic_period_idx
  ON public.commission_settlements (clinic_id, period_from, period_to);

GRANT SELECT, INSERT, UPDATE ON public.commission_settlements TO authenticated;
GRANT ALL ON public.commission_settlements TO service_role;
ALTER TABLE public.commission_settlements ENABLE ROW LEVEL SECURITY;

-- SELECT: owner/admin/accounting ven todo (mismo criterio que commission_rules);
-- ux-3 de la auditoría: el propio profesional también debe poder ver SU
-- liquidación, sin ver la de otros.
CREATE POLICY "commission_settlements_select_managers" ON public.commission_settlements
  FOR SELECT TO authenticated
  USING (public.has_clinic_role(clinic_id, ARRAY['owner','admin','accounting']::public.app_role[]));
CREATE POLICY "commission_settlements_select_own" ON public.commission_settlements
  FOR SELECT TO authenticated
  USING (
    professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid())
  );

-- INSERT (cerrar período): solo owner/admin, igual que definir la regla.
CREATE POLICY "commission_settlements_insert" ON public.commission_settlements
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_clinic(clinic_id));

-- UPDATE: solo para marcar paid_at/paid_by — nunca para tocar los montos
-- congelados (eso lo garantiza el código de la server function, no la
-- policy; RLS acá solo controla QUIÉN puede tocar la fila, no QUÉ columnas).
CREATE POLICY "commission_settlements_update_mark_paid" ON public.commission_settlements
  FOR UPDATE TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));

-- Nunca DELETE — un cierre es un evento contable, no se borra (mismo
-- criterio que security-1 de la auditoría del 21-ago).


-- ===== supabase/migrations/20260827030000_treatment_items_commission_index.sql =====
-- Auditoría 360 v2 (26-ago-2026) — arq-9: getCommissionReport filtra
-- treatment_items por (clinic_id, status='completed', completed_at BETWEEN
-- from AND to) sin ningún índice que cubra ese patrón — el índice existente
-- (clinic_id, plan_id, status) no ayuda porque el reporte no filtra por plan.
CREATE INDEX treatment_items_commission_report_idx
  ON public.treatment_items (clinic_id, status, completed_at);


-- ===== supabase/migrations/20260827040000_commission_rules_own_row_select.sql =====
-- Auditoría 360 v2 (26-ago-2026) — ux-3: sin esto, un dentist que llama
-- getCommissionReport filtrado a su propio professionalId igual ve
-- "Sin regla configurada" aunque SÍ tenga una regla, porque
-- commission_rules_select solo deja ver la fila a owner/admin/accounting —
-- RLS filtra en silencio la fila del propio profesional también.
CREATE POLICY "commission_rules_select_own" ON public.commission_rules
  FOR SELECT TO authenticated
  USING (
    professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid())
  );


-- ===== supabase/migrations/20260827050000_inventory_branch_segmentation.sql =====
-- product-2 (auditoría 360, P1): inventario por sucursal.
--
-- inventory_items no tenía branch_id — el hallazgo de auditoría asumía que
-- ya existía nullable, pero la migración original (20260822152000) nunca la
-- agregó. Clínicas con una sola sucursal (el caso común hoy) no necesitan
-- este campo para nada — por eso nullable sin default forzado: un ítem sin
-- branch_id es "compartido / sin sucursal asignada", no un error de datos.
--
-- No se segmenta current_stock por sucursal (seguiría siendo un solo
-- agregado por ítem, ver comentario de diseño en inventory_module.sql) —
-- esto es solo para que una clínica multi-sucursal pueda filtrar qué
-- ítems pertenecen a qué sede (ej. "guantes M" cargados por separado en
-- Sucursal Providencia vs Sucursal Ñuñoa), no un rediseño del ledger.
--
-- ON DELETE SET NULL: borrar una sucursal no debe arrastrar ítems de
-- inventario ni su historial de movimientos — el ítem queda "sin sucursal
-- asignada" en vez de desaparecer.

ALTER TABLE public.inventory_items
  ADD COLUMN branch_id uuid NULL REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX inventory_items_branch_idx
  ON public.inventory_items (clinic_id, branch_id)
  WHERE branch_id IS NOT NULL;


-- ===== supabase/migrations/20260827060000_f2_commission_settled_notice.sql =====
-- Auditoría 360 v2 (26-ago-2026), área Comunicaciones — F2, parte 1 de 2.
--
-- Comisiones liquidadas no generaban ningún aviso al profesional (ni email,
-- ni WhatsApp, ni toast persistente) — cerrar un período con
-- `closeCommissionPeriod` congelaba el snapshot en `commission_settlements`
-- pero el profesional no se enteraba nunca por fuera de entrar a mirar
-- /comisiones a mano.
--
-- Valor de enum solo, separado de la parte 2 (seed + backfill) porque
-- Postgres no permite usar un valor de `ALTER TYPE ... ADD VALUE` en la
-- misma transacción en que se agregó — mismo criterio que 20260816120000.

ALTER TYPE public.message_template_kind ADD VALUE IF NOT EXISTS 'commission_settled';


-- ===== supabase/migrations/20260827060100_f2_commission_settled_notice_seed.sql =====
-- Auditoría 360 v2 (26-ago-2026), área Comunicaciones — F2, parte 2 de 2.
--
-- Siembra el template `commission_settled` (channel=email) usado por
-- `closeCommissionPeriod` (commissions.functions.ts) para avisar al
-- profesional cuando se cierra su liquidación. Variables: {profesional}
-- (nombre del profesional, no {paciente} — el destinatario acá nunca es un
-- paciente), {periodo} (rango de fechas legible) y {monto} (comisión
-- formateada con formatMoney, respetando la moneda de la clínica).
--
-- Solo email por ahora: `closeCommissionPeriod` manda con `sendEmail`
-- directo (no pasa por `sendWhatsAppFromTemplate`/`sendEmailFromTemplate` de
-- messaging.functions.ts, que exigen patientId) y solo a profesionales con
-- `professionals.email` cargado. Si se agrega WhatsApp a profesionales más
-- adelante, sumar acá un segundo template channel=whatsapp del mismo kind.
--
-- Mismo patrón que 20260827000000 (F1/F3/F4) y 20260826260000 (nps_survey):
-- redefine handle_new_clinic() con el set completo + el template nuevo, y
-- hace backfill para las clínicas ya existentes.

CREATE OR REPLACE FUNCTION public.handle_new_clinic()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.clinic_members (clinic_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.message_templates (clinic_id, kind, name, channel, subject, body, created_by)
  VALUES
    (NEW.id, 'appointment_reminder', 'Recordatorio 48h antes', 'whatsapp', NULL,
     'Hola {paciente}, te recordamos tu cita de {tratamiento} el {fecha_larga} a las {hora}. Para confirmar responde SÍ, o RE para reagendar. Nos vemos en {clinica}. 🦷',
     NEW.created_by),
    (NEW.id, 'appointment_checkin', 'Aviso 3h antes', 'whatsapp', NULL,
     'Hola {paciente}, en unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos! Si no puedes venir, avísanos por acá.',
     NEW.created_by),
    (NEW.id, 'appointment_confirmation', 'Confirmación de cita nueva', 'whatsapp', NULL,
     'Hola {paciente}, tu cita quedó agendada: {tratamiento} el {fecha_larga} a las {hora} con {profesional}. Cualquier cambio, avísanos por acá. — {clinica}',
     NEW.created_by),
    (NEW.id, 'quote_sent', 'Envío de presupuesto', 'whatsapp', NULL,
     'Hola {paciente}, te compartimos el presupuesto {numero_presupuesto} por {total}. Cualquier duda, dinos y coordinamos cuando quieras arrancar. — {clinica}',
     NEW.created_by),
    (NEW.id, 'payment_receipt', 'Recibo de pago', 'whatsapp', NULL,
     'Hola {paciente}, recibimos tu pago de {monto} el {fecha}. Saldo pendiente: {saldo}. ¡Gracias! — {clinica}',
     NEW.created_by),
    (NEW.id, 'appointment_confirmation', 'Confirmación de cita (email)', 'email',
     'Tu cita en {clinica} quedó confirmada',
     '<p>Hola {paciente},</p><p>Tu cita quedó agendada:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li><li><strong>Profesional:</strong> {profesional}</li></ul><p>Cualquier cambio, responde este correo o escríbenos por WhatsApp.</p><p>— {clinica}</p>',
     NEW.created_by),
    (NEW.id, 'appointment_reminder', 'Recordatorio de cita (email)', 'email',
     'Recordatorio: tu cita en {clinica} es el {fecha_larga}',
     '<p>Hola {paciente},</p><p>Te recordamos tu cita:</p><ul><li><strong>Tratamiento:</strong> {tratamiento}</li><li><strong>Fecha:</strong> {fecha_larga}</li><li><strong>Hora:</strong> {hora}</li></ul><p>Si necesitas reagendar, escríbenos por WhatsApp o responde este correo.</p><p>— {clinica}</p>',
     NEW.created_by),
    (NEW.id, 'nps_survey', 'Encuesta de satisfacción', 'whatsapp', NULL,
     'Hola {paciente}, ¿cómo fue tu experiencia con {tratamiento} en {clinica}? Responde con una nota del 1 al 10 (10 = excelente) y cuéntanos qué mejorarías. ¡Gracias por ayudarnos a mejorar! 🙏',
     NEW.created_by),
    (NEW.id, 'nps_survey', 'Encuesta de satisfacción (email)', 'email',
     '¿Cómo fue tu experiencia en {clinica}?',
     '<p>Hola {paciente},</p><p>Queremos saber cómo fue tu experiencia con <strong>{tratamiento}</strong> en {clinica}.</p><p>Responde este correo con una nota del <strong>1 al 10</strong> (10 = excelente) y, si quieres, cuéntanos qué mejorarías.</p><p>¡Gracias por ayudarnos a mejorar!</p><p>— {clinica}</p>',
     NEW.created_by),
    (NEW.id, 'appointment_checkin', 'Aviso 3h antes (email)', 'email',
     'En unas horas tenés tu cita en {clinica}',
     '<p>Hola {paciente},</p><p>En unas horas es tu cita de {tratamiento} a las {hora} en {clinica}. ¡Te esperamos!</p><p>Si no puedes venir, escríbenos por WhatsApp o responde este correo.</p><p>— {clinica}</p>',
     NEW.created_by),
    (NEW.id, 'quote_sent', 'Envío de presupuesto (email)', 'email',
     'Tu presupuesto de {clinica}',
     '<p>Hola {paciente},</p><p>Te compartimos el presupuesto <strong>{numero_presupuesto}</strong> por <strong>{total}</strong>.</p><p>Cualquier duda, responde este correo o escríbenos por WhatsApp y coordinamos cuando quieras arrancar.</p><p>— {clinica}</p>',
     NEW.created_by),
    (NEW.id, 'payment_receipt', 'Recibo de pago (email)', 'email',
     'Recibimos tu pago — {clinica}',
     '<p>Hola {paciente},</p><p>Recibimos tu pago de <strong>{monto}</strong> el {fecha}.</p><p>Saldo pendiente: {saldo}.</p><p>¡Gracias!</p><p>— {clinica}</p>',
     NEW.created_by),
    -- F2 (comisiones liquidadas): aviso al profesional cuando se cierra su
    -- período. Destinatario = professionals, no patients — {profesional} en
    -- vez de {paciente}.
    (NEW.id, 'commission_settled', 'Comisión liquidada (email)', 'email',
     'Tu comisión de {periodo} quedó liquidada',
     '<p>Hola {profesional},</p><p>Se cerró tu liquidación de comisiones del período <strong>{periodo}</strong>.</p><p>Monto liquidado: <strong>{monto}</strong>.</p><p>Cualquier duda sobre el cálculo, escríbenos.</p><p>— {clinica}</p>',
     NEW.created_by)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

-- Backfill para clínicas ya existentes — idempotente.
INSERT INTO public.message_templates (clinic_id, kind, name, channel, subject, body, created_by)
SELECT c.id, 'commission_settled', 'Comisión liquidada (email)', 'email',
       'Tu comisión de {periodo} quedó liquidada',
       '<p>Hola {profesional},</p><p>Se cerró tu liquidación de comisiones del período <strong>{periodo}</strong>.</p><p>Monto liquidado: <strong>{monto}</strong>.</p><p>Cualquier duda sobre el cálculo, escríbenos.</p><p>— {clinica}</p>',
       c.created_by
FROM public.clinics c
ON CONFLICT DO NOTHING;


