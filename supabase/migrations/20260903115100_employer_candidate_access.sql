-- ==============================================================================
-- Migration: 20260903115100_employer_candidate_access.sql
-- Description: Allow employers to view interview_ready candidates and candidates who applied to their jobs
-- ==============================================================================

DROP POLICY IF EXISTS "candidates_select_employer_pool" ON public.candidates;
CREATE POLICY "candidates_select_employer_pool" ON public.candidates
FOR SELECT USING (
  status = 'interview_ready'
  OR id IN (
    SELECT ja.candidate_id FROM public.job_applications ja
    JOIN public.job_requirements jr ON ja.job_id = jr.id
    JOIN public.employers e ON jr.employer_id = e.id
    WHERE e.user_id = (SELECT auth.uid())
  )
);
