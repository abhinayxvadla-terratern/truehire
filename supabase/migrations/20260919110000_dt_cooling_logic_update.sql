-- Diagnostic Test Attempt & Cooling Logic Update
-- Adds consecutive and total fail tracking to candidates
-- Adds cooling_trigger to cooling_periods
-- Adjusts cooling_periods RLS for candidate status update on expiry

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS
  dt_consecutive_fails integer DEFAULT 0;

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS
  dt_total_fails_in_window integer DEFAULT 0;

ALTER TABLE cooling_periods
ADD COLUMN IF NOT EXISTS
  cooling_trigger text DEFAULT null;

-- Enable candidates to update their own cooling_periods (e.g. marking expired)
DROP POLICY IF EXISTS cooling_periods_update ON cooling_periods;
CREATE POLICY cooling_periods_update ON cooling_periods
  FOR UPDATE
  TO authenticated
  USING (is_internal() OR (candidate_id = get_my_candidate_id()))
  WITH CHECK (is_internal() OR (candidate_id = get_my_candidate_id()));
