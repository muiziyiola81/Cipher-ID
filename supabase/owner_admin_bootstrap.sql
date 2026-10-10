-- =============================================================================
-- CipherID — Secure Server-Side Owner-Admin Bootstrap Migration
-- =============================================================================
-- Note on Supabase `pgcrypto`:
--   In Supabase, extensions are installed in the `extensions` schema. Because
--   SECURITY DEFINER functions set `search_path = public, extensions`, both
--   `public` and `extensions` are searched, and we also qualify `extensions.crypt`
--   and `extensions.gen_salt` with explicit `::text` casts so PostgreSQL never
--   raises `42883: function gen_salt(unknown, integer) does not exist`.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- 1. Private Server-Only Configuration Table (Inaccessible to Client Roles)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.private_admin_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  owner_email TEXT NOT NULL,
  secret_bcrypt_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.private_admin_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.private_admin_config FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Update Trigger to Allow Trusted Server-Side (service_role / bootstrap)
--    While Keeping Strict Protection Against Ordinary Users
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_immutable_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  caller_is_admin BOOL := FALSE;
  jwt_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
  internal_bootstrap TEXT := COALESCE(current_setting('cipherid.owner_bootstrap_authorized', true), 'false');
BEGIN
  IF NEW.messaging_id IS DISTINCT FROM OLD.messaging_id THEN
    RAISE EXCEPTION 'Messaging ID is permanent and cannot be modified.';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT is_admin INTO caller_is_admin
    FROM public.profiles
    WHERE id = auth.uid();
  END IF;

  IF NOT (
    COALESCE(caller_is_admin, FALSE)
    OR jwt_role = 'service_role'
    OR internal_bootstrap = 'true'
  ) THEN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'Normal users cannot change administrator privileges.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Normal users cannot change account standing status.';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Server-Side Helper to Configure Owner Email & Hashed Secret (Run in SQL)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.configure_owner_admin_bootstrap(
  p_owner_email TEXT,
  p_raw_secret TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Forbidden: owner bootstrap configuration can only be set by the server.';
  END IF;

  IF char_length(trim(COALESCE(p_raw_secret, ''))) < 12 THEN
    RAISE EXCEPTION 'Bootstrap secret must be at least 12 characters long.';
  END IF;

  INSERT INTO public.private_admin_config (id, owner_email, secret_bcrypt_hash, updated_at)
  VALUES (
    1,
    lower(trim(p_owner_email)),
    extensions.crypt(trim(p_raw_secret)::text, extensions.gen_salt('bf'::text, 10)),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET owner_email = EXCLUDED.owner_email,
      secret_bcrypt_hash = EXCLUDED.secret_bcrypt_hash,
      updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.configure_owner_admin_bootstrap(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Secure, Idempotent Owner-Admin Bootstrap RPC (`public.claim_owner_admin`)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_owner_admin(bootstrap_secret TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user_email TEXT;
  v_cfg RECORD;
  v_profile RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: you must be signed in to CipherID.';
  END IF;

  SELECT owner_email, secret_bcrypt_hash
  INTO v_cfg
  FROM public.private_admin_config
  WHERE id = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Owner bootstrap secret has not been configured on the server yet.';
  END IF;

  SELECT lower(trim(email))
  INTO v_user_email
  FROM auth.users
  WHERE id = v_uid;

  IF v_user_email IS NULL OR v_user_email <> v_cfg.owner_email THEN
    RAISE EXCEPTION 'Forbidden: this account is not authorized for owner-admin bootstrap.';
  END IF;

  IF bootstrap_secret IS NULL
     OR extensions.crypt(trim(bootstrap_secret)::text, v_cfg.secret_bcrypt_hash) <> v_cfg.secret_bcrypt_hash THEN
    RAISE EXCEPTION 'Forbidden: invalid owner bootstrap secret.';
  END IF;

  SELECT id, messaging_id, is_admin
  INTO v_profile
  FROM public.profiles
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile record not found for authenticated user.';
  END IF;

  IF v_profile.is_admin = TRUE THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'isAdmin', true,
      'messagingId', v_profile.messaging_id,
      'message', 'Account already holds administrator privileges.'
    );
  END IF;

  PERFORM set_config('cipherid.owner_bootstrap_authorized', 'true', true);

  UPDATE public.profiles
  SET is_admin = TRUE,
      status = 'active',
      updated_at = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'isAdmin', true,
    'messagingId', v_profile.messaging_id,
    'message', 'Owner account successfully granted administrator privileges.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_owner_admin(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_owner_admin(TEXT) FROM PUBLIC, anon;
