-- Migration: 20260919130000_dt_dynamic_questions.sql
-- Description: Dynamic non-repeating Diagnostic Test questions schema

-- 1. dt_attempt_questions
CREATE TABLE IF NOT EXISTS public.dt_attempt_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.dt_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.dt_questions(id),
  position integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (attempt_id, question_id),
  UNIQUE (attempt_id, position)
);

CREATE INDEX IF NOT EXISTS idx_dt_attempt_questions_attempt ON public.dt_attempt_questions(attempt_id);

ALTER TABLE public.dt_attempt_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dt_attempt_questions_select ON public.dt_attempt_questions;
CREATE POLICY dt_attempt_questions_select ON public.dt_attempt_questions
  FOR SELECT
  USING (
    is_internal() = true
    OR attempt_id IN (
      SELECT id FROM public.dt_attempts
      WHERE candidate_id = get_my_candidate_id()
    )
  );

DROP POLICY IF EXISTS dt_attempt_questions_insert ON public.dt_attempt_questions;
CREATE POLICY dt_attempt_questions_insert ON public.dt_attempt_questions
  FOR INSERT
  WITH CHECK (
    is_internal() = true
    OR attempt_id IN (
      SELECT id FROM public.dt_attempts
      WHERE candidate_id = get_my_candidate_id()
    )
  );

DROP POLICY IF EXISTS dt_attempt_questions_internal_all ON public.dt_attempt_questions;
CREATE POLICY dt_attempt_questions_internal_all ON public.dt_attempt_questions
  FOR ALL
  USING (is_internal() = true)
  WITH CHECK (is_internal() = true);

-- 2. dt_candidate_seen_questions
CREATE TABLE IF NOT EXISTS public.dt_candidate_seen_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.dt_questions(id),
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  times_seen integer DEFAULT 1,
  UNIQUE (candidate_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_dt_seen_candidate ON public.dt_candidate_seen_questions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_dt_seen_question ON public.dt_candidate_seen_questions(question_id);

ALTER TABLE public.dt_candidate_seen_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dt_candidate_seen_questions_select ON public.dt_candidate_seen_questions;
CREATE POLICY dt_candidate_seen_questions_select ON public.dt_candidate_seen_questions
  FOR SELECT
  USING (
    is_internal() = true
    OR candidate_id = get_my_candidate_id()
  );

DROP POLICY IF EXISTS dt_candidate_seen_questions_insert ON public.dt_candidate_seen_questions;
CREATE POLICY dt_candidate_seen_questions_insert ON public.dt_candidate_seen_questions
  FOR INSERT
  WITH CHECK (
    is_internal() = true
    OR candidate_id = get_my_candidate_id()
  );

DROP POLICY IF EXISTS dt_candidate_seen_questions_update ON public.dt_candidate_seen_questions;
CREATE POLICY dt_candidate_seen_questions_update ON public.dt_candidate_seen_questions
  FOR UPDATE
  USING (
    is_internal() = true
    OR candidate_id = get_my_candidate_id()
  )
  WITH CHECK (
    is_internal() = true
    OR candidate_id = get_my_candidate_id()
  );

-- 3. dt_question_pool_stats view
CREATE OR REPLACE VIEW public.dt_question_pool_stats AS
SELECT
  difficulty_level,
  count(*) FILTER (WHERE is_active = true) AS active_count,
  count(*) FILTER (WHERE is_active = false) AS inactive_count,
  count(*) AS total_count
FROM public.dt_questions
GROUP BY difficulty_level
ORDER BY
  CASE difficulty_level
    WHEN 'beginner' THEN 1
    WHEN 'elementary' THEN 2
    WHEN 'intermediate' THEN 3
    WHEN 'upper_intermediate' THEN 4
  END;

GRANT SELECT ON public.dt_question_pool_stats TO authenticated, anon;

-- 4. record_candidate_seen_questions helper RPC
CREATE OR REPLACE FUNCTION public.record_candidate_seen_questions(
  p_candidate_id uuid,
  p_question_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qid uuid;
BEGIN
  IF p_question_ids IS NULL OR array_length(p_question_ids, 1) = 0 THEN
    RETURN;
  END IF;

  FOREACH qid IN ARRAY p_question_ids LOOP
    INSERT INTO public.dt_candidate_seen_questions (candidate_id, question_id, first_seen_at, last_seen_at, times_seen)
    VALUES (p_candidate_id, qid, now(), now(), 1)
    ON CONFLICT (candidate_id, question_id) DO UPDATE
      SET last_seen_at = now(),
          times_seen = public.dt_candidate_seen_questions.times_seen + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_candidate_seen_questions(uuid, uuid[]) TO authenticated, anon;
