-- ==============================================================================
-- Migration: 20260903123500_fix_auth_permissions_and_auto_profile.sql
-- Description: Grant table permissions on public schema to anon and authenticated,
--              add auto-confirm trigger, and add automatic profile & role creation triggers.
-- ==============================================================================

-- 1. Grant table privileges to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 2. Trigger function to auto-confirm new users so they can sign in immediately
CREATE OR REPLACE FUNCTION public.handle_new_user_before()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_confirm_user ON auth.users;
CREATE TRIGGER trg_auto_confirm_user
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_before();

-- 3. Trigger function to auto-create profile and role table record
CREATE OR REPLACE FUNCTION public.handle_new_user_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_first_name text;
  v_last_name text;
  v_company_name text;
  v_company_type text;
  v_location text;
  v_invite_token text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'candidate');
  v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  v_company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Partner Organization');
  v_company_type := COALESCE(NEW.raw_user_meta_data->>'company_type', 'placement_agency');
  v_location := COALESCE(NEW.raw_user_meta_data->>'location', 'Germany');
  v_invite_token := NEW.raw_user_meta_data->>'invite_token';

  -- Create or update profile
  INSERT INTO public.profiles (id, role, first_name, last_name, email, created_at, updated_at)
  VALUES (NEW.id, v_role, v_first_name, v_last_name, NEW.email, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    updated_at = now();

  -- Create role record
  IF v_role = 'candidate' THEN
    IF v_invite_token IS NOT NULL THEN
      UPDATE public.candidates
      SET user_id = NEW.id,
          invite_token = NULL
      WHERE invite_token = v_invite_token
        AND user_id IS NULL;
    END IF;

    -- If candidate record wasn't claimed, create one
    IF NOT EXISTS (SELECT 1 FROM public.candidates WHERE user_id = NEW.id) THEN
      INSERT INTO public.candidates (user_id, first_name, last_name, status)
      VALUES (NEW.id, v_first_name, v_last_name, 'onboarding');
    END IF;

  ELSIF v_role = 'supplier' THEN
    IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE user_id = NEW.id) THEN
      INSERT INTO public.suppliers (user_id, company_name, company_type, tier)
      VALUES (NEW.id, v_company_name, v_company_type, 'basic');
    END IF;

  ELSIF v_role = 'employer' THEN
    IF NOT EXISTS (SELECT 1 FROM public.employers WHERE user_id = NEW.id) THEN
      INSERT INTO public.employers (user_id, company_name, location)
      VALUES (NEW.id, v_company_name, v_location);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_after();

-- 4. Fix already registered user achuth@partnership.terratern.in
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email = 'achuth@partnership.terratern.in';

INSERT INTO public.profiles (id, role, first_name, last_name, email)
VALUES ('4cad3e56-6db8-4529-b93c-7ce573fc15f8', 'employer', 'Achuth', 'Reena', 'achuth@partnership.terratern.in')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employers (user_id, company_name, location)
VALUES ('4cad3e56-6db8-4529-b93c-7ce573fc15f8', 'Partner Organization', 'Germany')
ON CONFLICT (user_id) DO NOTHING;
