-- 1. Add assigned_rm_id column to candidates
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS assigned_rm_id uuid REFERENCES profiles(id) DEFAULT null;

-- 2. Add index for query performance
CREATE INDEX IF NOT EXISTS idx_candidates_assigned_rm ON candidates(assigned_rm_id);

-- 3. Trigger to enforce RLS / security on assigned_rm_id updates
CREATE OR REPLACE FUNCTION check_candidate_assigned_rm_update()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
  v_is_super boolean;
BEGIN
  IF NEW.assigned_rm_id IS DISTINCT FROM OLD.assigned_rm_id THEN
    -- Check if updated by a candidate themselves
    IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id THEN
      RAISE EXCEPTION 'Candidates cannot update their assigned account manager.';
    END IF;

    -- If updated by an authenticated user, check role permissions
    IF auth.uid() IS NOT NULL THEN
      SELECT internal_role, (role = 'super_admin')
      INTO v_role, v_is_super
      FROM profiles
      WHERE id = auth.uid();

      -- candidate_supplier_rm cannot update assigned_rm_id directly
      IF v_role = 'candidate_supplier_rm' THEN
        RAISE EXCEPTION 'Candidate and Supplier Account Managers cannot update RM assignments directly.';
      END IF;

      -- Only placement_lead or super_admin or service_role can update
      IF NOT (v_is_super IS TRUE OR v_role IN ('placement_lead', 'super_admin')) THEN
        RAISE EXCEPTION 'Only Placement Leads and Super Admins can update candidate RM assignments.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_candidate_assigned_rm_update ON candidates;
CREATE TRIGGER trg_candidate_assigned_rm_update
BEFORE UPDATE ON candidates
FOR EACH ROW
EXECUTE FUNCTION check_candidate_assigned_rm_update();

-- 4. Allow candidates to view their assigned RM's profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'candidates_can_select_assigned_rm_profile'
  ) THEN
    CREATE POLICY "candidates_can_select_assigned_rm_profile"
    ON profiles FOR SELECT
    TO authenticated
    USING (
      id IN (
        SELECT assigned_rm_id FROM candidates WHERE user_id = auth.uid()
      )
    );
  END IF;
END $$;

