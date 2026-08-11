DROP POLICY "clinics_select_members" ON public.clinics;
CREATE POLICY "clinics_select_members" ON public.clinics
FOR SELECT TO authenticated
USING (public.is_clinic_member(id) OR created_by = auth.uid());