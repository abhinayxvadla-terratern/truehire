-- ==============================================================================
-- Migration: 20260903131700_fix_rls_infinite_recursion.sql
-- Description: Replace cross-table recursive RLS policies on candidates,
--              job_applications, gate_results, and documents with SECURITY DEFINER
--              helper functions to prevent PostgreSQL 42P17 infinite recursion.
-- ==============================================================================

-- 1. Helper security definer functions to prevent circular RLS recursion
CREATE OR REPLACE FUNCTION public.get_auth_candidate_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.candidates WHERE user_id = (SELECT auth.uid()) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_supplier_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.suppliers WHERE user_id = (SELECT auth.uid()) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_employer_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.employers WHERE user_id = (SELECT auth.uid()) LIMIT 1;
$$;

-- 2. Clean up and replace candidates SELECT policy
DROP POLICY IF EXISTS "candidates_select" ON public.candidates;
DROP POLICY IF EXISTS "candidates_select_employer_pool" ON public.candidates;

CREATE POLICY "candidates_select" ON public.candidates
FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR (supplier_id IS NOT NULL AND supplier_id = public.get_auth_supplier_id())
  OR status = 'interview_ready'
  OR id IN (
    SELECT ja.candidate_id 
    FROM public.job_applications ja
    JOIN public.job_requirements jr ON ja.job_id = jr.id
    WHERE jr.employer_id = public.get_auth_employer_id()
  )
);

-- 3. Clean up and replace job_applications SELECT policy
DROP POLICY IF EXISTS "job_applications_select" ON public.job_applications;
CREATE POLICY "job_applications_select" ON public.job_applications
FOR SELECT USING (
  candidate_id = public.get_auth_candidate_id()
  OR (supplier_id IS NOT NULL AND supplier_id = public.get_auth_supplier_id())
  OR job_id IN (
    SELECT id FROM public.job_requirements 
    WHERE employer_id = public.get_auth_employer_id()
  )
);

-- 4. Clean up and replace gate_results SELECT policy
DROP POLICY IF EXISTS "gate_results_select" ON public.gate_results;
DROP POLICY IF EXISTS "gate_results_select_supplier" ON public.gate_results;

CREATE POLICY "gate_results_select" ON public.gate_results
FOR SELECT USING (
  candidate_id = public.get_auth_candidate_id()
  OR candidate_id IN (
    SELECT id FROM public.candidates 
    WHERE supplier_id = public.get_auth_supplier_id()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = (SELECT auth.uid()) AND role = 'internal'
  )
);

-- 5. Clean up and replace documents SELECT policy
DROP POLICY IF EXISTS "documents_select_own" ON public.documents;
DROP POLICY IF EXISTS "documents_select_supplier" ON public.documents;

CREATE POLICY "documents_select" ON public.documents
FOR SELECT USING (
  candidate_id = public.get_auth_candidate_id()
  OR candidate_id IN (
    SELECT id FROM public.candidates 
    WHERE supplier_id = public.get_auth_supplier_id()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = (SELECT auth.uid()) AND role = 'internal'
  )
);

-- 6. Clean up and replace candidate_offerings SELECT policy
DROP POLICY IF EXISTS "candidate_offerings_select" ON public.candidate_offerings;
CREATE POLICY "candidate_offerings_select" ON public.candidate_offerings
FOR SELECT USING (
  candidate_id = public.get_auth_candidate_id()
  OR candidate_id IN (
    SELECT id FROM public.candidates 
    WHERE supplier_id = public.get_auth_supplier_id()
  )
);
