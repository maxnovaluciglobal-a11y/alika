-- Índices para las foreign keys que se filtran o se unen en cada pantalla
-- clínica (ficha, agenda, mensajes, cobros). El advisor
-- `unindexed_foreign_keys` marcaba 76; acá van solo las de uso frecuente
-- (auditoría 360 del 07-oct-2026, anexo 06). Las demás (auditoría,
-- catálogos) pueden esperar a que haya volumen real.
--
-- Hoy las tablas son chicas (la mayor tiene ~130 filas), así que crear los
-- índices sin CONCURRENTLY toma milisegundos. IF NOT EXISTS: re-ejecutable.

create index if not exists appointments_patient_id_idx on public.appointments (patient_id);
create index if not exists appointments_professional_id_idx on public.appointments (professional_id);
create index if not exists appointments_branch_id_idx on public.appointments (branch_id);
create index if not exists appointment_requests_patient_id_idx on public.appointment_requests (patient_id);
create index if not exists messages_patient_id_idx on public.messages (patient_id);
create index if not exists messages_appointment_id_idx on public.messages (appointment_id);
create index if not exists messages_quote_id_idx on public.messages (quote_id);
create index if not exists payments_patient_id_idx on public.payments (patient_id);
create index if not exists payments_treatment_plan_id_idx on public.payments (treatment_plan_id);
create index if not exists quotes_patient_id_idx on public.quotes (patient_id);
create index if not exists treatment_plans_patient_id_idx on public.treatment_plans (patient_id);
create index if not exists odontogram_marks_patient_id_idx on public.odontogram_marks (patient_id);
create index if not exists periodontal_charts_patient_id_idx on public.periodontal_charts (patient_id);
create index if not exists patient_documents_patient_id_idx on public.patient_documents (patient_id);
create index if not exists patient_consents_patient_id_idx on public.patient_consents (patient_id);
create index if not exists lab_orders_patient_id_idx on public.lab_orders (patient_id);
create index if not exists ortho_cases_patient_id_idx on public.ortho_cases (patient_id);
create index if not exists waitlist_entries_patient_id_idx on public.waitlist_entries (patient_id);
create index if not exists portal_access_log_patient_id_idx on public.portal_access_log (patient_id);
