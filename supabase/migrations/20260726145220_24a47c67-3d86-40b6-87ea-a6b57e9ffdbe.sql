-- ENUM de roles
CREATE TYPE public.app_role AS ENUM ('owner','admin','dentist','assistant','reception','accounting');

-- Utilidad updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CLINICS (tenant)
CREATE TABLE public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  tax_id text,
  country text NOT NULL DEFAULT 'CL',
  currency text NOT NULL DEFAULT 'CLP',
  timezone text NOT NULL DEFAULT 'America/Santiago',
  logo_url text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CLINIC MEMBERS (roles en tabla separada)
CREATE TABLE public.clinic_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'reception',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, user_id, role)
);

-- Funciones SECURITY DEFINER (evitan recursión en RLS)
CREATE OR REPLACE FUNCTION public.is_clinic_member(_clinic_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = _clinic_id AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_clinic_role(_clinic_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members m
    WHERE m.clinic_id = _clinic_id AND m.user_id = auth.uid() AND m.role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_clinic(_clinic_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_clinic_role(_clinic_id, ARRAY['owner','admin']::public.app_role[]);
$$;

-- Al crear una clínica, el creador queda como owner
CREATE OR REPLACE FUNCTION public.handle_new_clinic()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.clinic_members (clinic_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_clinic_created AFTER INSERT ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.handle_new_clinic();
CREATE TRIGGER clinics_updated_at BEFORE UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinics TO authenticated;
GRANT ALL ON public.clinics TO service_role;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinics_select_members" ON public.clinics FOR SELECT TO authenticated USING (public.is_clinic_member(id));
CREATE POLICY "clinics_insert_self" ON public.clinics FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "clinics_update_managers" ON public.clinics FOR UPDATE TO authenticated USING (public.can_manage_clinic(id)) WITH CHECK (public.can_manage_clinic(id));
CREATE POLICY "clinics_delete_owner" ON public.clinics FOR DELETE TO authenticated USING (public.has_clinic_role(id, ARRAY['owner']::public.app_role[]));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_members TO authenticated;
GRANT ALL ON public.clinic_members TO service_role;
ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_select_same_clinic" ON public.clinic_members FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "members_insert_managers" ON public.clinic_members FOR INSERT TO authenticated WITH CHECK (public.can_manage_clinic(clinic_id) AND user_id <> auth.uid());
CREATE POLICY "members_update_managers" ON public.clinic_members FOR UPDATE TO authenticated USING (public.can_manage_clinic(clinic_id) AND user_id <> auth.uid()) WITH CHECK (public.can_manage_clinic(clinic_id) AND user_id <> auth.uid());
CREATE POLICY "members_delete_managers" ON public.clinic_members FOR DELETE TO authenticated USING (public.can_manage_clinic(clinic_id) AND user_id <> auth.uid());

-- BRANCHES
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  city text,
  phone text,
  email text,
  timezone text,
  opens_at time NOT NULL DEFAULT '08:00',
  closes_at time NOT NULL DEFAULT '20:00',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX branches_clinic_idx ON public.branches (clinic_id, name);
CREATE TRIGGER branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches_select" ON public.branches FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "branches_write" ON public.branches FOR ALL TO authenticated USING (public.can_manage_clinic(clinic_id)) WITH CHECK (public.can_manage_clinic(clinic_id));

-- OPERATORIES (boxes)
CREATE TABLE public.operatories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX operatories_clinic_idx ON public.operatories (clinic_id, branch_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operatories TO authenticated;
GRANT ALL ON public.operatories TO service_role;
ALTER TABLE public.operatories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operatories_select" ON public.operatories FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "operatories_write" ON public.operatories FOR ALL TO authenticated USING (public.can_manage_clinic(clinic_id)) WITH CHECK (public.can_manage_clinic(clinic_id));

-- SPECIALTIES
CREATE TABLE public.specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#0d9488',
  default_duration_min integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialties TO authenticated;
GRANT ALL ON public.specialties TO service_role;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "specialties_select" ON public.specialties FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "specialties_write" ON public.specialties FOR ALL TO authenticated USING (public.can_manage_clinic(clinic_id)) WITH CHECK (public.can_manage_clinic(clinic_id));

-- PROFESSIONALS
CREATE TABLE public.professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  specialty_id uuid REFERENCES public.specialties(id) ON DELETE SET NULL,
  user_id uuid,
  full_name text NOT NULL,
  email text,
  phone text,
  license_number text,
  color text NOT NULL DEFAULT '#0d9488',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX professionals_clinic_idx ON public.professionals (clinic_id, is_active);
CREATE TRIGGER professionals_updated_at BEFORE UPDATE ON public.professionals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professionals TO authenticated;
GRANT ALL ON public.professionals TO service_role;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "professionals_select" ON public.professionals FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "professionals_write" ON public.professionals FOR ALL TO authenticated USING (public.can_manage_clinic(clinic_id)) WITH CHECK (public.can_manage_clinic(clinic_id));