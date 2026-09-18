-- Add updated_by column to candidate profile tables for conflict tracking
ALTER TABLE candidate_personal_info ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES profiles(id);
ALTER TABLE candidate_education ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES profiles(id);
ALTER TABLE candidate_professional_registration ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES profiles(id);
ALTER TABLE candidate_work_experience ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES profiles(id);
ALTER TABLE candidate_language_proficiency ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES profiles(id);

-- 1. Candidate Profile RLS policies for Supplier
DROP POLICY IF EXISTS "supplier_can_read_personal_info" ON candidate_personal_info;
CREATE POLICY "supplier_can_read_personal_info" ON candidate_personal_info FOR SELECT
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "supplier_can_insert_personal_info" ON candidate_personal_info;
CREATE POLICY "supplier_can_insert_personal_info" ON candidate_personal_info FOR INSERT
WITH CHECK (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "supplier_can_update_personal_info" ON candidate_personal_info;
CREATE POLICY "supplier_can_update_personal_info" ON candidate_personal_info FOR UPDATE
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()))
WITH CHECK (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

-- Education
DROP POLICY IF EXISTS "supplier_can_read_education" ON candidate_education;
CREATE POLICY "supplier_can_read_education" ON candidate_education FOR SELECT
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "supplier_can_insert_education" ON candidate_education;
CREATE POLICY "supplier_can_insert_education" ON candidate_education FOR INSERT
WITH CHECK (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "supplier_can_update_education" ON candidate_education;
CREATE POLICY "supplier_can_update_education" ON candidate_education FOR UPDATE
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()))
WITH CHECK (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

-- Professional Registration
DROP POLICY IF EXISTS "supplier_can_read_prof_reg" ON candidate_professional_registration;
CREATE POLICY "supplier_can_read_prof_reg" ON candidate_professional_registration FOR SELECT
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "supplier_can_insert_prof_reg" ON candidate_professional_registration;
CREATE POLICY "supplier_can_insert_prof_reg" ON candidate_professional_registration FOR INSERT
WITH CHECK (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "supplier_can_update_prof_reg" ON candidate_professional_registration;
CREATE POLICY "supplier_can_update_prof_reg" ON candidate_professional_registration FOR UPDATE
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()))
WITH CHECK (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

-- Work Experience (includes DELETE)
DROP POLICY IF EXISTS "supplier_can_read_work_exp" ON candidate_work_experience;
CREATE POLICY "supplier_can_read_work_exp" ON candidate_work_experience FOR SELECT
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "supplier_can_insert_work_exp" ON candidate_work_experience;
CREATE POLICY "supplier_can_insert_work_exp" ON candidate_work_experience FOR INSERT
WITH CHECK (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "supplier_can_update_work_exp" ON candidate_work_experience;
CREATE POLICY "supplier_can_update_work_exp" ON candidate_work_experience FOR UPDATE
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()))
WITH CHECK (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "supplier_can_delete_work_exp" ON candidate_work_experience;
CREATE POLICY "supplier_can_delete_work_exp" ON candidate_work_experience FOR DELETE
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

-- Language Proficiency
DROP POLICY IF EXISTS "supplier_can_read_lang_prof" ON candidate_language_proficiency;
CREATE POLICY "supplier_can_read_lang_prof" ON candidate_language_proficiency FOR SELECT
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "supplier_can_insert_lang_prof" ON candidate_language_proficiency;
CREATE POLICY "supplier_can_insert_lang_prof" ON candidate_language_proficiency FOR INSERT
WITH CHECK (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "supplier_can_update_lang_prof" ON candidate_language_proficiency;
CREATE POLICY "supplier_can_update_lang_prof" ON candidate_language_proficiency FOR UPDATE
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()))
WITH CHECK (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

-- 2. Documents table write policies for Supplier
DROP POLICY IF EXISTS "supplier_can_insert_candidate_docs" ON documents;
CREATE POLICY "supplier_can_insert_candidate_docs" ON documents FOR INSERT
WITH CHECK (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "supplier_can_update_candidate_docs" ON documents;
CREATE POLICY "supplier_can_update_candidate_docs" ON documents FOR UPDATE
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()))
WITH CHECK (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

-- 3. Storage bucket policies for candidate-documents
DROP POLICY IF EXISTS "Suppliers can upload candidate documents" ON storage.objects;
CREATE POLICY "Suppliers can upload candidate documents" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'candidate-documents'
  AND (storage.foldername(name))[1] IN (SELECT id::text FROM candidates WHERE supplier_id = get_my_supplier_id())
);

DROP POLICY IF EXISTS "Suppliers can update candidate documents" ON storage.objects;
CREATE POLICY "Suppliers can update candidate documents" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'candidate-documents'
  AND (storage.foldername(name))[1] IN (SELECT id::text FROM candidates WHERE supplier_id = get_my_supplier_id())
);

DROP POLICY IF EXISTS "Suppliers can view candidate documents" ON storage.objects;
CREATE POLICY "Suppliers can view candidate documents" ON storage.objects FOR SELECT
USING (
  bucket_id = 'candidate-documents'
  AND (storage.foldername(name))[1] IN (SELECT id::text FROM candidates WHERE supplier_id = get_my_supplier_id())
);

-- 4. Read-only telemetry policies for Supplier
DROP POLICY IF EXISTS "suppliers_can_select_dt_attempts" ON dt_attempts;
CREATE POLICY "suppliers_can_select_dt_attempts" ON dt_attempts FOR SELECT
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "suppliers_can_select_speaking_schedules" ON speaking_test_schedules;
CREATE POLICY "suppliers_can_select_speaking_schedules" ON speaking_test_schedules FOR SELECT
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "suppliers_can_select_speaking_results" ON speaking_test_results;
CREATE POLICY "suppliers_can_select_speaking_results" ON speaking_test_results FOR SELECT
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "suppliers_can_select_cohort_members" ON cohort_members;
CREATE POLICY "suppliers_can_select_cohort_members" ON cohort_members FOR SELECT
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "suppliers_can_select_cohorts" ON cohorts;
CREATE POLICY "suppliers_can_select_cohorts" ON cohorts FOR SELECT
USING (id IN (SELECT cohort_id FROM cohort_members WHERE candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id())));

DROP POLICY IF EXISTS "suppliers_can_select_bootcamp_sessions" ON bootcamp_sessions;
CREATE POLICY "suppliers_can_select_bootcamp_sessions" ON bootcamp_sessions FOR SELECT
USING (cohort_id IN (SELECT cohort_id FROM cohort_members WHERE candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id())));

DROP POLICY IF EXISTS "suppliers_can_select_candidate_attendance" ON bootcamp_attendance;
CREATE POLICY "suppliers_can_select_candidate_attendance" ON bootcamp_attendance FOR SELECT
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "suppliers_can_select_final_test" ON final_test_attempts;
CREATE POLICY "suppliers_can_select_final_test" ON final_test_attempts FOR SELECT
USING (candidate_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "suppliers_can_select_candidate_rm" ON rm_assignments;
CREATE POLICY "suppliers_can_select_candidate_rm" ON rm_assignments FOR SELECT
USING (entity_type = 'candidate' AND entity_id IN (SELECT id FROM candidates WHERE supplier_id = get_my_supplier_id()));

DROP POLICY IF EXISTS "suppliers_can_select_supplier_member_profiles" ON profiles;
CREATE POLICY "suppliers_can_select_supplier_member_profiles" ON profiles FOR SELECT
USING (
  id IN (
    SELECT user_id FROM suppliers WHERE id = get_my_supplier_id()
    UNION
    SELECT is_admin_profile_id FROM suppliers WHERE id = get_my_supplier_id()
    UNION
    SELECT profile_id FROM supplier_team_members WHERE supplier_id = get_my_supplier_id()
  )
);
