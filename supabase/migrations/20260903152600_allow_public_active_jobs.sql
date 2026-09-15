-- Migration: 20260903152600_allow_public_active_jobs.sql
-- Description: Allow public anon and authenticated visitors to select active job requirements for the landing page opportunities section.

DROP POLICY IF EXISTS "job_requirements_select" ON public.job_requirements;

CREATE POLICY "job_requirements_select" ON public.job_requirements
FOR SELECT USING (
  status = 'active'
  OR employer_id = public.get_auth_employer_id()
);
