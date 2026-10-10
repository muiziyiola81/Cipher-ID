-- =============================================================================
-- CipherID Messaging — Complete Supabase PostgreSQL Schema & RLS Setup
-- =============================================================================
-- Run this script in your Supabase SQL Editor to create all relational tables,
-- unique 10-digit Messaging ID generator trigger, Row Level Security (RLS)
-- policies, Storage bucket for avatars, and Supabase Realtime publications.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Function to Generate Unique Random 10-Digit Messaging ID
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_unique_messaging_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id TEXT;
  done BOOL := FALSE;
BEGIN
  WHILE NOT done LOOP
    -- First digit 1-9, followed by 9 random digits (0-9) -> strictly 10 numeric digits
    new_id := (floor(random() * 9 + 1)::int)::text ||
              lpad(floor(random() * 1000000000)::bigint::text, 9, '0');
    IF length(new_id) = 10 AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE messaging_id = new_id
    ) THEN
      done := TRUE;
    END IF;
  END LOOP;
  RETURN new_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Profiles Table (No Email / PII exposed)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 60),
  username TEXT NOT NULL UNIQUE CHECK (char_length(username) BETWEEN 2 AND 32),
  messaging_id TEXT NOT NULL UNIQUE DEFAULT public.generate_unique_messaging_id() CHECK (messaging_id ~ '^[0-9]{10}$'),
  avatar_url TEXT NOT NULL DEFAULT 'obsidian-cyan',
  bio TEXT NOT NULL DEFAULT 'Available on CipherID' CHECK (char_length(bio) <= 160),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'restricted', 'suspended')),
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_allow_id_lookup BOOLEAN NOT NULL DEFAULT TRUE,
  privacy_show_read_receipts BOOLEAN NOT NULL DEFAULT TRUE,
  notif_in_app BOOLEAN NOT NULL DEFAULT TRUE,
  notif_sound BOOLEAN NOT NULL DEFAULT TRUE,
  notif_preview BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_messaging_id ON public.profiles(messaging_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Prevent users from modifying their own messaging_id or is_admin or status (unless admin or server-side bootstrap)
CREATE OR REPLACE FUNCTION public.protect_profile_immutable_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    SELECT is_admin INTO caller_is_admin FROM public.profiles WHERE id = auth.uid();
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

DROP TRIGGER IF EXISTS trg_protect_profile_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_immutable_columns();

-- Automatically create profile & unique 10-digit Messaging ID on auth.users sign up
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_name TEXT;
  clean_username TEXT;
BEGIN
  raw_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email, '@', 1),
    'Cipher User'
  );
  clean_username := lower(regexp_replace(
    COALESCE(NEW.raw_user_meta_data->>'username', raw_name),
    '[^a-zA-Z0-9_.]',
    '',
    'g'
  ));
  IF char_length(clean_username) < 2 THEN
    clean_username := 'user_' || floor(random() * 9000 + 1000)::int::text;
  END IF;
  -- Ensure username uniqueness
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = clean_username) THEN
    clean_username := substr(clean_username, 1, 24) || '_' || floor(random() * 9000 + 1000)::int::text;
  END IF;

  INSERT INTO public.profiles (
    id,
    display_name,
    username,
    messaging_id,
    avatar_url
  ) VALUES (
    NEW.id,
    substr(trim(raw_name), 1, 60),
    substr(clean_username, 1, 32),
    public.generate_unique_messaging_id(),
    'obsidian-cyan'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- 3. Conversations & Conversation Participants Tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_one_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_two_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_text TEXT NOT NULL DEFAULT '',
  last_message_sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unread_count_one INT NOT NULL DEFAULT 0,
  unread_count_two INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversations_distinct_participants CHECK (participant_one_id <> participant_two_id),
  CONSTRAINT conversations_unique_pair UNIQUE (participant_one_id, participant_two_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_p1 ON public.conversations(participant_one_id);
CREATE INDEX IF NOT EXISTS idx_conversations_p2 ON public.conversations(participant_two_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON public.conversations(last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON public.conversation_participants(user_id);

-- -----------------------------------------------------------------------------
-- 4. Messages Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  reply_to_text TEXT NOT NULL DEFAULT '',
  reply_to_sender_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at ASC);

-- -----------------------------------------------------------------------------
-- 5. Blocks Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blocks_no_self_block CHECK (blocker_id <> blocked_id),
  CONSTRAINT blocks_unique_pair UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks(blocked_id);

-- -----------------------------------------------------------------------------
-- 6. Reports Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('Spam', 'Harassment', 'Scam', 'Impersonation', 'Other')),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- -----------------------------------------------------------------------------
-- 7. Notifications Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'message' CHECK (type IN ('message', 'system')),
  title TEXT NOT NULL DEFAULT 'New Message',
  body TEXT NOT NULL DEFAULT '',
  reference_id UUID,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 8. Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to check admin role safely
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), FALSE);
$$;

-- Helper function to check if two users have a block relationship
CREATE OR REPLACE FUNCTION public.are_users_blocked(uid_a UUID, uid_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = uid_a AND blocked_id = uid_b)
       OR (blocker_id = uid_b AND blocked_id = uid_a)
  );
$$;

-- Helper function to check user account status safely
CREATE OR REPLACE FUNCTION public.get_user_account_status(target_uid UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT status FROM public.profiles WHERE id = target_uid),
    'suspended'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_active()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT status = 'active' FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_not_suspended()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT status IN ('active', 'restricted') FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

-- Trigger to enforce active account standing on conversation & message creation
CREATE OR REPLACE FUNCTION public.enforce_active_status_for_messaging()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_status TEXT;
  v_other_uid UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_caller_status := public.get_user_account_status(auth.uid());

  IF v_caller_status = 'suspended' THEN
    RAISE EXCEPTION 'Your account has been suspended and cannot use messaging features.';
  END IF;

  IF v_caller_status = 'restricted' THEN
    IF TG_TABLE_NAME = 'conversations' THEN
      RAISE EXCEPTION 'Your account is currently restricted and cannot start new conversations.';
    ELSE
      RAISE EXCEPTION 'Your account is currently restricted and cannot send new messages.';
    END IF;
  END IF;

  IF v_caller_status <> 'active' THEN
    RAISE EXCEPTION 'Your account is not active and cannot perform this messaging action.';
  END IF;

  IF TG_TABLE_NAME = 'conversations' THEN
    IF NEW.participant_one_id = auth.uid() THEN
      v_other_uid := NEW.participant_two_id;
    ELSE
      v_other_uid := NEW.participant_one_id;
    END IF;
    IF public.get_user_account_status(v_other_uid) = 'suspended' THEN
      RAISE EXCEPTION 'Cannot start a conversation with a suspended account.';
    END IF;
  ELSIF TG_TABLE_NAME = 'messages' THEN
    SELECT CASE
             WHEN c.participant_one_id = auth.uid() THEN c.participant_two_id
             ELSE c.participant_one_id
           END
    INTO v_other_uid
    FROM public.conversations c
    WHERE c.id = NEW.conversation_id;

    IF v_other_uid IS NOT NULL AND public.get_user_account_status(v_other_uid) = 'suspended' THEN
      RAISE EXCEPTION 'Cannot send messages to a suspended account.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_active_on_conversations ON public.conversations;
CREATE TRIGGER trg_enforce_active_on_conversations
BEFORE INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.enforce_active_status_for_messaging();

DROP TRIGGER IF EXISTS trg_enforce_active_on_messages ON public.messages;
CREATE TRIGGER trg_enforce_active_on_messages
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_active_status_for_messaging();

-- Profiles RLS
CREATE POLICY "Users can read active profiles or own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR status <> 'suspended' OR public.is_current_user_admin());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() AND is_admin = FALSE AND status = 'active');

CREATE POLICY "Users can update own profile or admin can update status"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    (id = auth.uid() AND public.is_current_user_not_suspended())
    OR public.is_current_user_admin()
  )
  WITH CHECK (
    (id = auth.uid() AND public.is_current_user_not_suspended())
    OR public.is_current_user_admin()
  );

-- Conversations RLS
CREATE POLICY "Participants can view their conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    (
      (participant_one_id = auth.uid() OR participant_two_id = auth.uid())
      AND public.is_current_user_not_suspended()
    )
    OR public.is_current_user_admin()
  );

CREATE POLICY "Participants can create conversations if not blocked"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_current_user_active()
    AND (participant_one_id = auth.uid() OR participant_two_id = auth.uid())
    AND public.get_user_account_status(participant_one_id) <> 'suspended'
    AND public.get_user_account_status(participant_two_id) <> 'suspended'
    AND NOT public.are_users_blocked(participant_one_id, participant_two_id)
  );

CREATE POLICY "Participants can update their conversations"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (
    (participant_one_id = auth.uid() OR participant_two_id = auth.uid())
    AND public.is_current_user_not_suspended()
  )
  WITH CHECK (
    (participant_one_id = auth.uid() OR participant_two_id = auth.uid())
    AND public.is_current_user_not_suspended()
  );

-- Conversation Participants RLS
CREATE POLICY "Participants can view conversation_participants"
  ON public.conversation_participants FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_not_suspended()
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id
          AND (c.participant_one_id = auth.uid() OR c.participant_two_id = auth.uid())
      )
    )
  );

CREATE POLICY "Participants can insert conversation_participants"
  ON public.conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_current_user_active()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.participant_one_id = auth.uid() OR c.participant_two_id = auth.uid())
    )
  );

-- Messages RLS
CREATE POLICY "Conversation participants can read messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    (
      public.is_current_user_not_suspended()
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND (c.participant_one_id = auth.uid() OR c.participant_two_id = auth.uid())
      )
    )
    OR public.is_current_user_admin()
  );

CREATE POLICY "Conversation participants can send messages if not blocked"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_current_user_active()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_one_id = auth.uid() OR c.participant_two_id = auth.uid())
        AND public.get_user_account_status(c.participant_one_id) <> 'suspended'
        AND public.get_user_account_status(c.participant_two_id) <> 'suspended'
        AND NOT public.are_users_blocked(c.participant_one_id, c.participant_two_id)
    )
  );

CREATE POLICY "Sender can soft-delete or recipient can mark read"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    (
      public.is_current_user_not_suspended()
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND (c.participant_one_id = auth.uid() OR c.participant_two_id = auth.uid())
      )
    )
    OR public.is_current_user_admin()
  );

-- Blocks RLS
CREATE POLICY "Users can view blocks involving them"
  ON public.blocks FOR SELECT
  TO authenticated
  USING (blocker_id = auth.uid() OR blocked_id = auth.uid() OR public.is_current_user_admin());

CREATE POLICY "Users can create blocks as blocker"
  ON public.blocks FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = auth.uid() AND public.is_current_user_not_suspended());

CREATE POLICY "Blocker can unblock"
  ON public.blocks FOR DELETE
  TO authenticated
  USING (blocker_id = auth.uid() OR public.is_current_user_admin());

-- Reports RLS
CREATE POLICY "Reporters and admins can view reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid() OR public.is_current_user_admin());

CREATE POLICY "Authenticated users can submit reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND status = 'pending'
    AND public.is_current_user_not_suspended()
  );

CREATE POLICY "Only admins can update report status"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- Notifications RLS
CREATE POLICY "Users can read their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can create message notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_current_user_active());

CREATE POLICY "Users can mark own notifications read"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 9. Supabase Storage Bucket for Profile Pictures (`avatars`)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload their own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated users can update their own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- -----------------------------------------------------------------------------
-- 10. Enable Supabase Realtime on Messaging Tables
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
