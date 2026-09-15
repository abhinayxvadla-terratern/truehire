-- ==============================================================================
-- Migration: 20260903112000_initial_schema.sql
-- Description: Complete database schema for TerraTern (TrueHire)
-- Tables: profiles, suppliers, candidates, employers, gate_results, documents,
--         job_requirements, job_applications, offerings, candidate_offerings, notifications
-- ==============================================================================

-- 0. Extensions & Helper Functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Secure existing event trigger helper if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable') THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
  END IF;
END $$;

-- ==============================================================================
-- 1. TABLE: profiles
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('candidate', 'supplier', 'employer', 'internal')),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 2. TABLE: suppliers
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  company_type text NOT NULL CHECK (company_type IN ('placement_agency', 'language_school', 'training_center', 'other')),
  registration_number text,
  tier text NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'verified', 'audited')),
  compliance_declared boolean NOT NULL DEFAULT false,
  no_fee_policy_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 3. TABLE: candidates
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_name text,
  last_name text,
  nationality text,
  target_role text CHECK (target_role IS NULL OR target_role IN ('nursing', 'ausbildung', 'care', 'other')),
  language_level_self_reported text CHECK (language_level_self_reported IS NULL OR language_level_self_reported IN ('A2', 'B1', 'B2')),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invite_token text UNIQUE,
  status text NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'in_progress', 'interview_ready', 'placed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 4. TABLE: employers
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.employers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  industry text,
  location text,
  subscription_tier text NOT NULL DEFAULT 'basic',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 5. TABLE: gate_results
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.gate_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  gate_type text NOT NULL CHECK (gate_type IN ('dt', 'doc_verification', 'speaking_test', 'bootcamp', 'assessment')),
  status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'pass', 'fail')),
  attempt_number integer NOT NULL DEFAULT 1,
  score numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 6. TABLE: documents
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('passport', 'degree', 'work_experience', 'reference_letter')),
  file_url text,
  status text NOT NULL DEFAULT 'not_uploaded' CHECK (status IN ('not_uploaded', 'pending', 'under_review', 'verified', 'rejected')),
  rejection_reason text,
  uploaded_at timestamptz
);

-- ==============================================================================
-- 7. TABLE: job_requirements
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.job_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  title text NOT NULL,
  location text NOT NULL,
  role_type text NOT NULL CHECK (role_type IN ('nursing', 'ausbildung', 'care', 'other')),
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  submission_cap integer NOT NULL DEFAULT 10,
  current_submissions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 8. TABLE: job_applications
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.job_requirements(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  submitted_by text NOT NULL CHECK (submitted_by IN ('candidate', 'supplier')),
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'shortlisted', 'interview_scheduled', 'interviewed', 'selected', 'offer_sent', 'reveal_gate', 'placed', 'rejected')),
  fit_score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_job_applications_updated_at ON public.job_applications;
CREATE TRIGGER trg_job_applications_updated_at
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 9. TABLE: offerings
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('training', 'language_course')),
  price numeric NOT NULL,
  applicable_gate text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 10. TABLE: candidate_offerings
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.candidate_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  offering_id uuid NOT NULL REFERENCES public.offerings(id) ON DELETE CASCADE,
  gate_type_failed text,
  status text NOT NULL DEFAULT 'recommended' CHECK (status IN ('recommended', 'availed', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 11. TABLE: notifications
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('gate_result', 'application_update', 'document', 'employer_interest', 'general')),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- INDEXES FOR FOREIGN KEYS & RLS PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON public.suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON public.candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_supplier_id ON public.candidates(supplier_id);
CREATE INDEX IF NOT EXISTS idx_employers_user_id ON public.employers(user_id);
CREATE INDEX IF NOT EXISTS idx_gate_results_candidate_id ON public.gate_results(candidate_id);
CREATE INDEX IF NOT EXISTS idx_documents_candidate_id ON public.documents(candidate_id);
CREATE INDEX IF NOT EXISTS idx_job_requirements_employer_id ON public.job_requirements(employer_id);
CREATE INDEX IF NOT EXISTS idx_job_requirements_status ON public.job_requirements(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_candidate_id ON public.job_applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_supplier_id ON public.job_applications(supplier_id);
CREATE INDEX IF NOT EXISTS idx_candidate_offerings_candidate_id ON public.candidate_offerings(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_offerings_offering_id ON public.candidate_offerings(offering_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- ==============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- RLS POLICIES
-- ==============================================================================

-- 1. profiles: users can read and write only their own row
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE USING (id = (SELECT auth.uid()));

-- 2. suppliers: supplier can read/write own row
DROP POLICY IF EXISTS "suppliers_select_own" ON public.suppliers;
CREATE POLICY "suppliers_select_own" ON public.suppliers
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "suppliers_insert_own" ON public.suppliers;
CREATE POLICY "suppliers_insert_own" ON public.suppliers
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "suppliers_update_own" ON public.suppliers;
CREATE POLICY "suppliers_update_own" ON public.suppliers
  FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "suppliers_delete_own" ON public.suppliers;
CREATE POLICY "suppliers_delete_own" ON public.suppliers
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- 3. candidates: candidate can read/write own row. Supplier can read rows where supplier_id matches their supplier id.
DROP POLICY IF EXISTS "candidates_select" ON public.candidates;
CREATE POLICY "candidates_select" ON public.candidates
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    OR supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "candidates_insert_own" ON public.candidates;
CREATE POLICY "candidates_insert_own" ON public.candidates
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "candidates_update_own" ON public.candidates;
CREATE POLICY "candidates_update_own" ON public.candidates
  FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "candidates_delete_own" ON public.candidates;
CREATE POLICY "candidates_delete_own" ON public.candidates
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- 4. employers: employer can read/write own row
DROP POLICY IF EXISTS "employers_select_own" ON public.employers;
CREATE POLICY "employers_select_own" ON public.employers
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "employers_insert_own" ON public.employers;
CREATE POLICY "employers_insert_own" ON public.employers
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "employers_update_own" ON public.employers;
CREATE POLICY "employers_update_own" ON public.employers
  FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "employers_delete_own" ON public.employers;
CREATE POLICY "employers_delete_own" ON public.employers
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- 5. gate_results: candidate can read own rows. Authenticated users with role 'internal' can write (service role also bypasses)
DROP POLICY IF EXISTS "gate_results_select" ON public.gate_results;
CREATE POLICY "gate_results_select" ON public.gate_results
  FOR SELECT USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'internal')
  );

DROP POLICY IF EXISTS "gate_results_insert_internal" ON public.gate_results;
CREATE POLICY "gate_results_insert_internal" ON public.gate_results
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'internal')
  );

DROP POLICY IF EXISTS "gate_results_update_internal" ON public.gate_results;
CREATE POLICY "gate_results_update_internal" ON public.gate_results
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'internal')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'internal')
  );

DROP POLICY IF EXISTS "gate_results_delete_internal" ON public.gate_results;
CREATE POLICY "gate_results_delete_internal" ON public.gate_results
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'internal')
  );

-- 6. documents: candidate can read/write own rows
DROP POLICY IF EXISTS "documents_select_own" ON public.documents;
CREATE POLICY "documents_select_own" ON public.documents
  FOR SELECT USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "documents_insert_own" ON public.documents;
CREATE POLICY "documents_insert_own" ON public.documents
  FOR INSERT WITH CHECK (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "documents_update_own" ON public.documents;
CREATE POLICY "documents_update_own" ON public.documents
  FOR UPDATE USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = (SELECT auth.uid()))
  ) WITH CHECK (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "documents_delete_own" ON public.documents;
CREATE POLICY "documents_delete_own" ON public.documents
  FOR DELETE USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = (SELECT auth.uid()))
  );

-- 7. job_requirements: all authenticated users can read active rows. Employer can insert/update own rows.
DROP POLICY IF EXISTS "job_requirements_select" ON public.job_requirements;
CREATE POLICY "job_requirements_select" ON public.job_requirements
  FOR SELECT USING (
    ((SELECT auth.role()) = 'authenticated' AND status = 'active')
    OR employer_id IN (SELECT id FROM public.employers WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "job_requirements_insert_own" ON public.job_requirements;
CREATE POLICY "job_requirements_insert_own" ON public.job_requirements
  FOR INSERT WITH CHECK (
    employer_id IN (SELECT id FROM public.employers WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "job_requirements_update_own" ON public.job_requirements;
CREATE POLICY "job_requirements_update_own" ON public.job_requirements
  FOR UPDATE USING (
    employer_id IN (SELECT id FROM public.employers WHERE user_id = (SELECT auth.uid()))
  ) WITH CHECK (
    employer_id IN (SELECT id FROM public.employers WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "job_requirements_delete_own" ON public.job_requirements;
CREATE POLICY "job_requirements_delete_own" ON public.job_requirements
  FOR DELETE USING (
    employer_id IN (SELECT id FROM public.employers WHERE user_id = (SELECT auth.uid()))
  );

-- 8. job_applications: candidate can read own. Supplier can read where supplier_id matches. Employer can read applications for their jobs.
DROP POLICY IF EXISTS "job_applications_select" ON public.job_applications;
CREATE POLICY "job_applications_select" ON public.job_applications
  FOR SELECT USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = (SELECT auth.uid()))
    OR (supplier_id IS NOT NULL AND supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = (SELECT auth.uid())))
    OR job_id IN (
      SELECT jr.id FROM public.job_requirements jr
      JOIN public.employers e ON jr.employer_id = e.id
      WHERE e.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "job_applications_insert" ON public.job_applications;
CREATE POLICY "job_applications_insert" ON public.job_applications
  FOR INSERT WITH CHECK (
    (submitted_by = 'candidate' AND candidate_id IN (SELECT id FROM public.candidates WHERE user_id = (SELECT auth.uid())))
    OR (submitted_by = 'supplier' AND supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = (SELECT auth.uid())))
  );

DROP POLICY IF EXISTS "job_applications_update_employer" ON public.job_applications;
CREATE POLICY "job_applications_update_employer" ON public.job_applications
  FOR UPDATE USING (
    job_id IN (
      SELECT jr.id FROM public.job_requirements jr
      JOIN public.employers e ON jr.employer_id = e.id
      WHERE e.user_id = (SELECT auth.uid())
    )
  ) WITH CHECK (
    job_id IN (
      SELECT jr.id FROM public.job_requirements jr
      JOIN public.employers e ON jr.employer_id = e.id
      WHERE e.user_id = (SELECT auth.uid())
    )
  );

-- 9. offerings: all authenticated users can read where is_active = true
DROP POLICY IF EXISTS "offerings_select_active" ON public.offerings;
CREATE POLICY "offerings_select_active" ON public.offerings
  FOR SELECT USING (
    (SELECT auth.role()) = 'authenticated' AND is_active = true
  );

-- 10. candidate_offerings: candidate can read/write own rows
DROP POLICY IF EXISTS "candidate_offerings_select_own" ON public.candidate_offerings;
CREATE POLICY "candidate_offerings_select_own" ON public.candidate_offerings
  FOR SELECT USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "candidate_offerings_insert_own" ON public.candidate_offerings;
CREATE POLICY "candidate_offerings_insert_own" ON public.candidate_offerings
  FOR INSERT WITH CHECK (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "candidate_offerings_update_own" ON public.candidate_offerings;
CREATE POLICY "candidate_offerings_update_own" ON public.candidate_offerings
  FOR UPDATE USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = (SELECT auth.uid()))
  ) WITH CHECK (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "candidate_offerings_delete_own" ON public.candidate_offerings;
CREATE POLICY "candidate_offerings_delete_own" ON public.candidate_offerings
  FOR DELETE USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = (SELECT auth.uid()))
  );

-- 11. notifications: user can read/update own rows
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (
    user_id = (SELECT auth.uid())
  ) WITH CHECK (
    user_id = (SELECT auth.uid())
  );
