-- ==============================================================================
-- Migration: 20260908130000_super_admin_updates.sql
-- Description: Super Admin messaging constraint/RLS, audit constraint updates, and atomic cascade delete functions
-- ==============================================================================

-- 1. Update sender_type constraint on employer_rm_messages
ALTER TABLE public.employer_rm_messages
DROP CONSTRAINT IF EXISTS employer_rm_messages_sender_type_check;

ALTER TABLE public.employer_rm_messages
ADD CONSTRAINT employer_rm_messages_sender_type_check
CHECK (sender_type IN (
  'employer',
  'rm',
  'placement_lead',
  'super_admin'
));

-- 2. Update RLS policy for super_admin on employer_rm_messages
DROP POLICY IF EXISTS "super_admin_can_write_messages" ON public.employer_rm_messages;
CREATE POLICY "super_admin_can_write_messages"
ON public.employer_rm_messages
FOR INSERT
WITH CHECK (is_super_admin() = true);

-- 3. Update dt_question_audit constraint to include 'deleted'
ALTER TABLE public.dt_question_audit
DROP CONSTRAINT IF EXISTS dt_question_audit_action_check;

ALTER TABLE public.dt_question_audit
ADD CONSTRAINT dt_question_audit_action_check
CHECK (action IN (
  'created',
  'updated',
  'deactivated',
  'reactivated',
  'deleted'
));

-- 4. Update rubric_audit constraint to include 'deleted'
ALTER TABLE public.rubric_audit
DROP CONSTRAINT IF EXISTS rubric_audit_action_check;

ALTER TABLE public.rubric_audit
ADD CONSTRAINT rubric_audit_action_check
CHECK (action IN (
  'created',
  'updated',
  'deactivated',
  'reactivated',
  'deleted'
));

-- 5. Foreign key on dt_answers to SET NULL on question deletion
ALTER TABLE public.dt_answers
DROP CONSTRAINT IF EXISTS dt_answers_question_id_fkey;

ALTER TABLE public.dt_answers
ADD CONSTRAINT dt_answers_question_id_fkey
FOREIGN KEY (question_id) REFERENCES public.dt_questions(id) ON DELETE SET NULL;

-- 6. Foreign key on dt_question_audit to SET NULL on question deletion
ALTER TABLE public.dt_question_audit
DROP CONSTRAINT IF EXISTS dt_question_audit_question_id_fkey;

ALTER TABLE public.dt_question_audit
ADD CONSTRAINT dt_question_audit_question_id_fkey
FOREIGN KEY (question_id) REFERENCES public.dt_questions(id) ON DELETE SET NULL;

-- 7. Foreign key on rubric_audit to SET NULL on criterion deletion
ALTER TABLE public.rubric_audit
DROP CONSTRAINT IF EXISTS rubric_audit_criterion_id_fkey;

ALTER TABLE public.rubric_audit
ADD CONSTRAINT rubric_audit_criterion_id_fkey
FOREIGN KEY (criterion_id) REFERENCES public.speaking_test_rubric_criteria(id) ON DELETE SET NULL;

-- 8. Admin Delete Candidate Cascade Function
CREATE OR REPLACE FUNCTION public.admin_delete_candidate(p_candidate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only super_admin can delete candidates';
  END IF;

  SELECT user_id INTO v_user_id FROM public.candidates WHERE id = p_candidate_id;

  -- Delete non-cascading references
  DELETE FROM public.mentor_assignments WHERE candidate_id = p_candidate_id;
  DELETE FROM public.academic_requests WHERE candidate_id = p_candidate_id;
  DELETE FROM public.internal_notes WHERE candidate_id = p_candidate_id;
  DELETE FROM public.mentor_proposals WHERE candidate_id = p_candidate_id;
  DELETE FROM public.speaking_test_schedules WHERE candidate_id = p_candidate_id;

  -- Delete speaking test rubric scores and results
  DELETE FROM public.speaking_test_rubric_scores WHERE result_id IN (
    SELECT id FROM public.speaking_test_results WHERE candidate_id = p_candidate_id
  );
  DELETE FROM public.speaking_test_results WHERE candidate_id = p_candidate_id;

  DELETE FROM public.cohort_members WHERE candidate_id = p_candidate_id;
  DELETE FROM public.bootcamp_attendance WHERE candidate_id = p_candidate_id;
  DELETE FROM public.final_test_attempts WHERE candidate_id = p_candidate_id;
  DELETE FROM public.employer_candidate_interests WHERE candidate_id = p_candidate_id;

  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.notifications WHERE user_id = v_user_id;
  END IF;

  -- Delete candidate
  DELETE FROM public.candidates WHERE id = p_candidate_id;

  -- Delete auth user
  IF v_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_user_id;
  END IF;
END;
$$;

-- 9. Admin Delete Supplier Cascade Function
CREATE OR REPLACE FUNCTION public.admin_delete_supplier(p_supplier_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_user_id uuid;
  v_team_user_ids uuid[];
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only super_admin can delete suppliers';
  END IF;

  SELECT user_id INTO v_supplier_user_id FROM public.suppliers WHERE id = p_supplier_id;

  SELECT array_agg(profile_id) INTO v_team_user_ids
  FROM public.supplier_team_members
  WHERE supplier_id = p_supplier_id AND profile_id IS NOT NULL;

  -- Unlink candidates
  UPDATE public.candidates SET supplier_id = NULL WHERE supplier_id = p_supplier_id;

  -- Delete RM assignments
  DELETE FROM public.rm_assignments WHERE entity_type = 'supplier' AND entity_id = p_supplier_id;

  -- Delete supplier (cascades team_members, documents, notes, bulk_uploads)
  DELETE FROM public.suppliers WHERE id = p_supplier_id;

  -- Delete auth users for supplier team members
  IF v_team_user_ids IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = ANY(v_team_user_ids);
  END IF;

  -- Delete supplier main auth user
  IF v_supplier_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_supplier_user_id;
  END IF;
END;
$$;

-- 10. Admin Delete Employer Cascade Function
CREATE OR REPLACE FUNCTION public.admin_delete_employer(p_employer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employer_user_id uuid;
  v_team_user_ids uuid[];
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only super_admin can delete employers';
  END IF;

  SELECT user_id INTO v_employer_user_id FROM public.employers WHERE id = p_employer_id;

  SELECT array_agg(profile_id) INTO v_team_user_ids
  FROM public.employer_team_members
  WHERE employer_id = p_employer_id AND profile_id IS NOT NULL;

  -- Mark job applications for this employer's requirements as rejected
  UPDATE public.job_applications
  SET status = 'rejected'
  WHERE job_id IN (SELECT id FROM public.job_requirements WHERE employer_id = p_employer_id);

  -- Delete non-cascading references
  DELETE FROM public.employer_candidate_interests WHERE employer_id = p_employer_id;
  DELETE FROM public.employer_rm_messages WHERE employer_id = p_employer_id;
  DELETE FROM public.rm_assignments WHERE entity_type = 'employer' AND entity_id = p_employer_id;

  -- Delete employer (cascades team_members, job_requirements)
  DELETE FROM public.employers WHERE id = p_employer_id;

  -- Delete team member auth users
  IF v_team_user_ids IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = ANY(v_team_user_ids);
  END IF;

  -- Delete employer main auth user
  IF v_employer_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_employer_user_id;
  END IF;
END;
$$;
