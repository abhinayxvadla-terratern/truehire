-- Migration: 20260918183000_fix_profiles_rls_recursion.sql
-- Fixes infinite recursion on profiles queries by preventing inlining of SECURITY DEFINER functions.

-- 1. Rewrite is_internal() in PL/pgSQL to prevent query-planner inlining
CREATE OR REPLACE FUNCTION public.is_internal()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_is_internal boolean;
BEGIN
  SELECT is_internal INTO v_is_internal
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN COALESCE(v_is_internal, false);
END;
$$;

-- 2. Rewrite is_super_admin() in PL/pgSQL
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_is_super boolean;
BEGIN
  SELECT (role = 'super_admin' OR internal_role = 'super_admin') INTO v_is_super
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN COALESCE(v_is_super, false);
END;
$$;

-- 3. Rewrite get_my_supplier_id() in PL/pgSQL
CREATE OR REPLACE FUNCTION public.get_my_supplier_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_supplier_id uuid;
BEGIN
  SELECT id INTO v_supplier_id
  FROM public.suppliers
  WHERE user_id = auth.uid() OR is_admin_profile_id = auth.uid()
  LIMIT 1;

  IF v_supplier_id IS NOT NULL THEN
    RETURN v_supplier_id;
  END IF;

  SELECT supplier_id INTO v_supplier_id
  FROM public.supplier_team_members
  WHERE (profile_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    AND invite_status IN ('accepted', 'active')
  LIMIT 1;

  RETURN v_supplier_id;
END;
$$;

-- 4. Supplier member profiles helper in PL/pgSQL
CREATE OR REPLACE FUNCTION public.get_supplier_member_profile_ids()
RETURNS TABLE (profile_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_sup_id uuid;
BEGIN
  v_sup_id := get_my_supplier_id();
  IF v_sup_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT user_id FROM public.suppliers WHERE id = v_sup_id AND user_id IS NOT NULL
  UNION
  SELECT is_admin_profile_id FROM public.suppliers WHERE id = v_sup_id AND is_admin_profile_id IS NOT NULL
  UNION
  SELECT stm.profile_id FROM public.supplier_team_members stm WHERE stm.supplier_id = v_sup_id AND stm.profile_id IS NOT NULL;
END;
$$;

DROP POLICY IF EXISTS "suppliers_can_select_supplier_member_profiles" ON profiles;
CREATE POLICY "suppliers_can_select_supplier_member_profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  id IN (SELECT profile_id FROM get_supplier_member_profile_ids())
);

-- 5. Candidate assigned RM helper in PL/pgSQL
CREATE OR REPLACE FUNCTION public.get_candidate_assigned_rm_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_rm_id uuid;
BEGIN
  SELECT assigned_rm_id INTO v_rm_id
  FROM public.candidates
  WHERE user_id = auth.uid()
  LIMIT 1;
  RETURN v_rm_id;
END;
$$;

DROP POLICY IF EXISTS "candidates_can_select_assigned_rm_profile" ON profiles;
CREATE POLICY "candidates_can_select_assigned_rm_profile"
ON profiles FOR SELECT
TO authenticated
USING (
  id = get_candidate_assigned_rm_id()
);
