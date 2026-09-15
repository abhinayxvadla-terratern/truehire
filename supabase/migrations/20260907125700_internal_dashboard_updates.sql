-- ==============================================================================
-- Migration: Internal Dashboard Updates Schema & RLS Changes
-- ==============================================================================

-- PART 1: ALTER employer_rm_messages
ALTER TABLE public.employer_rm_messages
DROP CONSTRAINT IF EXISTS employer_rm_messages_sender_type_check;

ALTER TABLE public.employer_rm_messages
ADD CONSTRAINT employer_rm_messages_sender_type_check
CHECK (sender_type IN (
  'employer', 'rm', 'placement_lead'
));

ALTER TABLE public.employer_rm_messages
ADD COLUMN IF NOT EXISTS
  sender_display_name text DEFAULT null;

-- PART 2: NEW TABLE — dt_question_audit
CREATE TABLE IF NOT EXISTS public.dt_question_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES public.dt_questions(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created','updated','deactivated','reactivated')),
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  previous_data jsonb DEFAULT null,
  new_data jsonb DEFAULT null,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.dt_question_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dt_question_audit_select" ON public.dt_question_audit;
CREATE POLICY "dt_question_audit_select" ON public.dt_question_audit
FOR SELECT TO authenticated
USING (get_internal_role() IN ('academic_lead', 'super_admin'));

DROP POLICY IF EXISTS "dt_question_audit_insert" ON public.dt_question_audit;
CREATE POLICY "dt_question_audit_insert" ON public.dt_question_audit
FOR INSERT TO authenticated
WITH CHECK (get_internal_role() IN ('academic_lead', 'super_admin'));

-- PART 3: NEW TABLE — rubric_audit
CREATE TABLE IF NOT EXISTS public.rubric_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criterion_id uuid REFERENCES public.speaking_test_rubric_criteria(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created','updated','deactivated','reactivated')),
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  previous_data jsonb DEFAULT null,
  new_data jsonb DEFAULT null,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.rubric_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rubric_audit_select" ON public.rubric_audit;
CREATE POLICY "rubric_audit_select" ON public.rubric_audit
FOR SELECT TO authenticated
USING (get_internal_role() IN ('academic_lead', 'super_admin'));

DROP POLICY IF EXISTS "rubric_audit_insert" ON public.rubric_audit;
CREATE POLICY "rubric_audit_insert" ON public.rubric_audit
FOR INSERT TO authenticated
WITH CHECK (get_internal_role() IN ('academic_lead', 'super_admin'));

-- PART 4: ALTER notifications TABLE
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN (
  'gate_result',
  'application_update',
  'document',
  'employer_interest',
  'general',
  'rm_assignment_request'
));

-- PART 5: ALTER rm_assignments TABLE
ALTER TABLE public.rm_assignments
ADD COLUMN IF NOT EXISTS
  requested_by uuid REFERENCES public.profiles(id) DEFAULT null;

ALTER TABLE public.rm_assignments
ADD COLUMN IF NOT EXISTS
  request_notes text DEFAULT null;

-- PART 6: NEW TABLE — internal_messages
CREATE TABLE IF NOT EXISTS public.internal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  related_entity_type text DEFAULT null CHECK (related_entity_type IN (
    'candidate', 'supplier', 'employer', 'application', 'cohort', null
  )),
  related_entity_id uuid DEFAULT null,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "internal_messages_insert" ON public.internal_messages;
CREATE POLICY "internal_messages_insert" ON public.internal_messages
FOR INSERT TO authenticated
WITH CHECK (is_internal() = true AND sender_id = auth.uid());

DROP POLICY IF EXISTS "internal_messages_select" ON public.internal_messages;
CREATE POLICY "internal_messages_select" ON public.internal_messages
FOR SELECT TO authenticated
USING (
  (is_internal() = true AND (sender_id = auth.uid() OR recipient_id = auth.uid()))
  OR get_internal_role() = 'super_admin'
);

DROP POLICY IF EXISTS "internal_messages_update" ON public.internal_messages;
CREATE POLICY "internal_messages_update" ON public.internal_messages
FOR UPDATE TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- PART 7: ADD COLUMNS TO speaking_test_rubric_criteria
ALTER TABLE public.speaking_test_rubric_criteria
ADD COLUMN IF NOT EXISTS
  updated_by uuid REFERENCES public.profiles(id) DEFAULT null;

ALTER TABLE public.speaking_test_rubric_criteria
ADD COLUMN IF NOT EXISTS
  updated_at timestamptz DEFAULT now();

-- PART 8: ADD COLUMNS TO dt_questions
ALTER TABLE public.dt_questions
ADD COLUMN IF NOT EXISTS
  updated_by uuid REFERENCES public.profiles(id) DEFAULT null;

ALTER TABLE public.dt_questions
ADD COLUMN IF NOT EXISTS
  updated_at timestamptz DEFAULT now();

-- PART 9: UPDATED RLS POLICIES
-- dt_questions
DROP POLICY IF EXISTS "dt_questions_admin_manage" ON public.dt_questions;
CREATE POLICY "dt_questions_admin_manage" ON public.dt_questions
FOR ALL TO authenticated
USING (get_internal_role() IN ('academic_lead', 'super_admin'))
WITH CHECK (get_internal_role() IN ('academic_lead', 'super_admin'));

DROP POLICY IF EXISTS "dt_questions_select" ON public.dt_questions;
CREATE POLICY "dt_questions_select" ON public.dt_questions
FOR SELECT TO authenticated
USING (
  (is_active = true) OR (get_internal_role() IN ('academic_lead', 'super_admin'))
);

-- speaking_test_rubric_criteria
DROP POLICY IF EXISTS "rubric_criteria_manage" ON public.speaking_test_rubric_criteria;
CREATE POLICY "rubric_criteria_manage" ON public.speaking_test_rubric_criteria
FOR ALL TO authenticated
USING (get_internal_role() IN ('academic_lead', 'super_admin'))
WITH CHECK (get_internal_role() IN ('academic_lead', 'super_admin'));

DROP POLICY IF EXISTS "rubric_criteria_select" ON public.speaking_test_rubric_criteria;
CREATE POLICY "rubric_criteria_select" ON public.speaking_test_rubric_criteria
FOR SELECT TO authenticated
USING (
  (is_active = true) OR (get_internal_role() IN ('academic_lead', 'super_admin'))
);

-- employer_rm_messages
DROP POLICY IF EXISTS "employer_messages_insert_internal" ON public.employer_rm_messages;
CREATE POLICY "employer_messages_insert_internal" ON public.employer_rm_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_profile_id = auth.uid() AND (
    (get_internal_role() = 'placement_lead' AND sender_type IN ('placement_lead', 'rm'))
    OR
    (get_internal_role() = 'employer_requirements_rm' AND sender_type = 'rm')
  )
);

DROP POLICY IF EXISTS "employer_messages_select_internal" ON public.employer_rm_messages;
CREATE POLICY "employer_messages_select_internal" ON public.employer_rm_messages
FOR SELECT TO authenticated
USING (
  get_internal_role() IN ('placement_lead', 'super_admin')
  OR (
    get_internal_role() = 'employer_requirements_rm'
    AND employer_id IN (
      SELECT entity_id FROM public.rm_assignments
      WHERE rm_profile_id = auth.uid()
        AND entity_type = 'employer'
        AND active = true
    )
  )
);

DROP POLICY IF EXISTS "employer_messages_update" ON public.employer_rm_messages;
CREATE POLICY "employer_messages_update" ON public.employer_rm_messages
FOR UPDATE TO authenticated
USING (
  (employer_id = get_my_employer_id())
  OR (get_internal_role() IN ('placement_lead', 'employer_requirements_rm'))
)
WITH CHECK (
  (employer_id = get_my_employer_id())
  OR (get_internal_role() IN ('placement_lead', 'employer_requirements_rm'))
);
