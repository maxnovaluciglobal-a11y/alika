-- Políticas RLS que llamaban auth.uid() por FILA (advisor auth_rls_initplan,
-- 34 políticas; auditoría 360 del 07-oct-2026, anexo 06). Envolverlo en
-- `(select auth.uid())` hace que Postgres lo evalúe una sola vez por consulta
-- (initplan). La lógica de cada política no cambia: mismo comando, mismos
-- roles, misma condición. Generado a partir de pg_policies de producción.
--
-- ALTER POLICY solo reemplaza USING / WITH CHECK; no toca permisos ni roles.

alter policy "agreements_insert_managers" on public.agreements
  with check ((can_manage_clinic(clinic_id) AND (created_by = ( select auth.uid()))));

alter policy "cash_registers_insert_cashiers" on public.cash_registers
  with check ((has_clinic_role(clinic_id, ARRAY['owner'::app_role, 'admin'::app_role, 'reception'::app_role, 'accounting'::app_role]) AND (opened_by = ( select auth.uid()))));

alter policy "members_delete_managers" on public.clinic_members
  using ((can_manage_clinic(clinic_id) AND (user_id <> ( select auth.uid()))));

alter policy "members_insert_managers" on public.clinic_members
  with check ((can_manage_clinic(clinic_id) AND (user_id <> ( select auth.uid()))));

alter policy "members_update_managers" on public.clinic_members
  using ((can_manage_clinic(clinic_id) AND (user_id <> ( select auth.uid()))))
  with check ((can_manage_clinic(clinic_id) AND (user_id <> ( select auth.uid()))));

alter policy "Equipo clinico registra revisiones" on public.clinical_note_reviews
  with check (((actor_id = ( select auth.uid())) AND has_clinic_role(clinic_id, ARRAY['owner'::app_role, 'admin'::app_role, 'dentist'::app_role, 'assistant'::app_role])));

alter policy "note_versions_insert_clinical" on public.clinical_note_versions
  with check ((has_clinic_role(clinic_id, ARRAY['owner'::app_role, 'admin'::app_role, 'dentist'::app_role, 'assistant'::app_role]) AND (author_id = ( select auth.uid()))));

alter policy "notes_insert_clinical" on public.clinical_notes
  with check ((has_clinic_role(clinic_id, ARRAY['owner'::app_role, 'admin'::app_role, 'dentist'::app_role, 'assistant'::app_role]) AND (created_by = ( select auth.uid()))));

alter policy "notes_update_clinical" on public.clinical_notes
  using ((has_clinic_role(clinic_id, ARRAY['owner'::app_role, 'admin'::app_role, 'dentist'::app_role, 'assistant'::app_role]) AND ((created_by = ( select auth.uid())) OR (reviewer_id = ( select auth.uid())) OR (review_requested_by = ( select auth.uid())) OR has_clinic_role(clinic_id, ARRAY['owner'::app_role, 'admin'::app_role, 'dentist'::app_role]))));

alter policy "clinics_insert_self" on public.clinics
  with check ((created_by = ( select auth.uid())));

alter policy "clinics_select_members" on public.clinics
  using ((is_clinic_member(id) OR (created_by = ( select auth.uid()))));

alter policy "commission_rules_select_own" on public.commission_rules
  using ((professional_id IN ( SELECT professionals.id
   FROM professionals
  WHERE (professionals.user_id = ( select auth.uid())))));

alter policy "commission_settlements_select_own" on public.commission_settlements
  using ((professional_id IN ( SELECT professionals.id
   FROM professionals
  WHERE (professionals.user_id = ( select auth.uid())))));

alter policy "expenses_select_finance_roles_write" on public.expenses
  with check ((has_clinic_role(clinic_id, ARRAY['owner'::app_role, 'admin'::app_role, 'accounting'::app_role]) AND (created_by = ( select auth.uid()))));

alter policy "inventory_counts_insert_operational" on public.inventory_counts
  with check ((has_clinic_role(clinic_id, ARRAY['owner'::app_role, 'admin'::app_role, 'dentist'::app_role, 'assistant'::app_role]) AND (counted_by = ( select auth.uid()))));

alter policy "inventory_items_insert_managers" on public.inventory_items
  with check ((can_manage_clinic(clinic_id) AND (created_by = ( select auth.uid()))));

alter policy "inventory_movements_insert_clinical" on public.inventory_movements
  with check ((has_clinic_role(clinic_id, ARRAY['owner'::app_role, 'admin'::app_role, 'dentist'::app_role, 'assistant'::app_role]) AND (recorded_by = ( select auth.uid()))));

alter policy "lab_orders_insert_operativo" on public.lab_orders
  with check ((has_clinic_role(clinic_id, ARRAY['owner'::app_role, 'admin'::app_role, 'dentist'::app_role, 'assistant'::app_role, 'reception'::app_role, 'accounting'::app_role]) AND (created_by = ( select auth.uid()))));

alter policy "labs_insert_managers" on public.labs
  with check ((can_manage_clinic(clinic_id) AND (created_by = ( select auth.uid()))));

alter policy "own prefs delete" on public.notification_preferences
  using ((user_id = ( select auth.uid())));

alter policy "own prefs insert" on public.notification_preferences
  with check ((user_id = ( select auth.uid())));

alter policy "own prefs select" on public.notification_preferences
  using ((user_id = ( select auth.uid())));

alter policy "own prefs update" on public.notification_preferences
  using ((user_id = ( select auth.uid())))
  with check ((user_id = ( select auth.uid())));

alter policy "Actualizar mis notificaciones" on public.notifications
  using ((recipient_id = ( select auth.uid())))
  with check ((recipient_id = ( select auth.uid())));

alter policy "Borrar mis notificaciones" on public.notifications
  using ((recipient_id = ( select auth.uid())));

alter policy "Crear notificaciones dentro de mi clinica" on public.notifications
  with check ((is_clinic_member(clinic_id) AND (actor_id = ( select auth.uid())) AND is_clinic_member_of(clinic_id, recipient_id)));

alter policy "Ver mis notificaciones" on public.notifications
  using ((recipient_id = ( select auth.uid())));

alter policy "odontogram_insert_clinical" on public.odontogram_marks
  with check ((has_clinic_role(clinic_id, ARRAY['owner'::app_role, 'admin'::app_role, 'dentist'::app_role]) AND (recorded_by = ( select auth.uid()))));

alter policy "patient_consents_insert" on public.patient_consents
  with check ((has_clinic_role(clinic_id, ARRAY['owner'::app_role, 'admin'::app_role, 'dentist'::app_role, 'assistant'::app_role]) AND (recorded_by = ( select auth.uid()))));

alter policy "patient_documents_insert" on public.patient_documents
  with check ((has_clinic_role(clinic_id, ARRAY['owner'::app_role, 'admin'::app_role, 'dentist'::app_role, 'assistant'::app_role]) AND (uploaded_by = ( select auth.uid()))));

alter policy "patients_insert_front_desk" on public.patients
  with check ((has_clinic_role(clinic_id, ARRAY['owner'::app_role, 'admin'::app_role, 'dentist'::app_role, 'reception'::app_role]) AND (created_by = ( select auth.uid()))));

alter policy "periodontal_charts_insert_clinical" on public.periodontal_charts
  with check ((has_clinic_role(clinic_id, ARRAY['owner'::app_role, 'admin'::app_role, 'dentist'::app_role]) AND (recorded_by = ( select auth.uid()))));

alter policy "profiles_select_own_or_clinic" on public.profiles
  using (((id = ( select auth.uid())) OR shares_clinic_with(id)));

alter policy "profiles_update_own" on public.profiles
  using ((id = ( select auth.uid())))
  with check ((id = ( select auth.uid())));
