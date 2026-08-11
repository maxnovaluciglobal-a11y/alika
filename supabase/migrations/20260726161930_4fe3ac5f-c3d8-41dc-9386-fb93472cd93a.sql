REVOKE ALL ON FUNCTION public.enforce_clinical_note_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_note_review_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_note_version_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clinic_role_of(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_clinic() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_clinic_member_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_clinic_member_of(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_clinic_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_clinic_member(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.has_clinic_role(uuid, public.app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_clinic_role(uuid, public.app_role[]) TO authenticated;
REVOKE ALL ON FUNCTION public.can_manage_clinic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_clinic(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.shares_clinic_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_clinic_with(uuid) TO authenticated;