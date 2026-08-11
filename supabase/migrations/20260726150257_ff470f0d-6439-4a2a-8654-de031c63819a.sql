CREATE OR REPLACE FUNCTION public.shares_clinic_with(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_members me
    JOIN public.clinic_members other ON other.clinic_id = me.clinic_id
    WHERE me.user_id = auth.uid() AND other.user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own_or_clinic" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.shares_clinic_with(id));