-- Migration: 20260919120000_internal_multi_role_support.sql
-- Description: Multi-role support for internal team members

CREATE TABLE IF NOT EXISTS public.internal_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (
    role IN (
      'super_admin',
      'partnerships_lead',
      'supplier_partnerships_associate',
      'employer_partnerships_associate',
      'placement_lead',
      'candidate_supplier_rm',
      'employer_requirements_rm',
      'academic_lead',
      'mentor'
    )
  ),
  is_primary boolean DEFAULT false,
  assigned_by uuid REFERENCES public.profiles(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE (profile_id, role)
);

CREATE INDEX IF NOT EXISTS idx_internal_user_roles_profile_id ON public.internal_user_roles(profile_id);

-- Enable RLS
ALTER TABLE public.internal_user_roles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Internal users can view their own roles
DROP POLICY IF EXISTS internal_user_roles_select_own ON public.internal_user_roles;
CREATE POLICY internal_user_roles_select_own ON public.internal_user_roles
  FOR SELECT
  USING (is_internal() = true AND profile_id = auth.uid());

-- Policy 2: Super admin has full access
DROP POLICY IF EXISTS internal_user_roles_super_admin_all ON public.internal_user_roles;
CREATE POLICY internal_user_roles_super_admin_all ON public.internal_user_roles
  FOR ALL
  USING (is_super_admin() = true)
  WITH CHECK (is_super_admin() = true);

-- Seed existing internal profiles into internal_user_roles
INSERT INTO public.internal_user_roles (profile_id, role, is_primary, assigned_by)
SELECT
  id,
  internal_role,
  true,
  id
FROM public.profiles
WHERE is_internal = true
  AND internal_role IS NOT NULL
ON CONFLICT (profile_id, role) DO NOTHING;

-- Helper function: has_role
CREATE OR REPLACE FUNCTION public.has_role(check_role text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_user_roles
    WHERE profile_id = auth.uid()
    AND role = check_role
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Trigger to automatically populate internal_user_roles when a profile is created or updated with internal_role
CREATE OR REPLACE FUNCTION public.handle_profile_internal_role_sync()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_internal = true AND NEW.internal_role IS NOT NULL THEN
    INSERT INTO public.internal_user_roles (profile_id, role, is_primary, assigned_by)
    VALUES (NEW.id, NEW.internal_role, true, COALESCE(auth.uid(), NEW.id))
    ON CONFLICT (profile_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_profile_internal_role ON public.profiles;
CREATE TRIGGER trg_sync_profile_internal_role
AFTER INSERT OR UPDATE OF internal_role, is_internal ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_profile_internal_role_sync();
