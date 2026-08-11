REVOKE EXECUTE ON FUNCTION public.shares_clinic_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_clinic_with(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_clinic_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_clinic_member(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_clinic_role(uuid, app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_clinic_role(uuid, app_role[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage_clinic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_clinic(uuid) TO authenticated;