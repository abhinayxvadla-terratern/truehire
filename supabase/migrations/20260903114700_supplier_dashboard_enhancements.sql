-- ==============================================================================
-- Migration: 20260903114700_supplier_dashboard_enhancements.sql
-- Description: Additional policies, triggers, and RPCs for Supplier Dashboard and Invite system
-- ==============================================================================

-- 1. Allow suppliers to insert candidates with their supplier_id
DROP POLICY IF EXISTS "suppliers_insert_candidates" ON public.candidates;
CREATE POLICY "suppliers_insert_candidates" ON public.candidates
FOR INSERT WITH CHECK (
  supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = (SELECT auth.uid()))
);

-- 2. Allow suppliers to update candidates where supplier_id matches
DROP POLICY IF EXISTS "suppliers_update_candidates" ON public.candidates;
CREATE POLICY "suppliers_update_candidates" ON public.candidates
FOR UPDATE USING (
  supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = (SELECT auth.uid()))
) WITH CHECK (
  supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = (SELECT auth.uid()))
);

-- 3. Allow suppliers to view gate_results of their candidates
DROP POLICY IF EXISTS "gate_results_select_supplier" ON public.gate_results;
CREATE POLICY "gate_results_select_supplier" ON public.gate_results
FOR SELECT USING (
  candidate_id IN (
    SELECT c.id FROM public.candidates c
    JOIN public.suppliers s ON c.supplier_id = s.id
    WHERE s.user_id = (SELECT auth.uid())
  )
);

-- 4. Allow suppliers to view documents of their candidates
DROP POLICY IF EXISTS "documents_select_supplier" ON public.documents;
CREATE POLICY "documents_select_supplier" ON public.documents
FOR SELECT USING (
  candidate_id IN (
    SELECT c.id FROM public.candidates c
    JOIN public.suppliers s ON c.supplier_id = s.id
    WHERE s.user_id = (SELECT auth.uid())
  )
);

-- 5. Allow authenticated users to insert notifications
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
FOR INSERT WITH CHECK (
  (SELECT auth.role()) = 'authenticated'
);

-- 6. Trigger to increment job_requirements current_submissions atomically
CREATE OR REPLACE FUNCTION public.increment_job_submissions()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.job_requirements
  SET current_submissions = current_submissions + 1
  WHERE id = NEW.job_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_job_submissions ON public.job_applications;
CREATE TRIGGER trg_increment_job_submissions
AFTER INSERT ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.increment_job_submissions();

-- 7. Secure function to look up invite token
CREATE OR REPLACE FUNCTION public.get_invite_details(p_token text)
RETURNS TABLE (
  candidate_id uuid,
  first_name text,
  last_name text,
  target_role text,
  supplier_company_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS candidate_id,
    c.first_name,
    c.last_name,
    c.target_role,
    s.company_name AS supplier_company_name
  FROM public.candidates c
  LEFT JOIN public.suppliers s ON c.supplier_id = s.id
  WHERE c.invite_token = p_token
  LIMIT 1;
END;
$$;

-- 8. Secure function to claim invite token upon registration
CREATE OR REPLACE FUNCTION public.claim_invite_token(p_token text, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.candidates
  SET user_id = p_user_id,
      invite_token = NULL
  WHERE invite_token = p_token
    AND user_id IS NULL;
    
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
