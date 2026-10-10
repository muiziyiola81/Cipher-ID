-- =============================================================================
-- CipherID — Account Standing Enforcement Migration (Active / Restricted / Suspended)
-- =============================================================================
-- Root Cause Identified:
--   Previously, the RLS policies on `public.conversations`, `public.messages`,
--   `public.conversation_participants`, and `public.notifications` only checked
--   whether the user was a conversation participant and not blocked (`are_users_blocked`),
--   without checking the user's `status` column in `public.profiles`.
--   As a result, an account marked `restricted` (or `suspended`) could still
--   insert rows into `public.messages` or `public.conversations`.
--
-- Enforcement Policy Implemented Here:
--   1. `active`:
--      - Full access to send messages, start conversations, and update profile.
--   2. `restricted`:
--      - Can sign in and read existing conversation history (`SELECT`),
--      - CANNOT send new messages (`INSERT` on `public.messages` denied by RLS & trigger),
--      - CANNOT start new conversations (`INSERT` on `public.conversations` &
--        `public.conversation_participants` denied by RLS & trigger),
--      - CANNOT generate message notifications (`INSERT` on `public.notifications` denied).
--   3. `suspended`:
--      - Blocked from all messaging and protected app functions (`SELECT`/`INSERT`/`UPDATE`
--        on conversations, messages, blocks, reports, notifications, and profile edits),
--        while still able to read their own `public.profiles` row so the app can
--        display the Account Suspended notice cleanly.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Trusted Server-Side Helper Functions for Account Standing
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 2. Defence-in-Depth Database Triggers on `conversations` and `messages`
--    (Provides clear, explicit error messages and prevents any bypass)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_active_status_for_messaging()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_status TEXT;
  v_other_uid UUID;
  v_other_status TEXT;
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

  -- Also verify the recipient account is not suspended when starting a conversation or sending a message
  IF TG_TABLE_NAME = 'conversations' THEN
    IF NEW.participant_one_id = auth.uid() THEN
      v_other_uid := NEW.participant_two_id;
    ELSE
      v_other_uid := NEW.participant_one_id;
    END IF;
    v_other_status := public.get_user_account_status(v_other_uid);
    IF v_other_status = 'suspended' THEN
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

-- -----------------------------------------------------------------------------
-- 3. Update Row Level Security (RLS) Policies Across Protected Tables
-- -----------------------------------------------------------------------------

-- PROFILES: Prevent suspended non-admin users from editing their profile
DROP POLICY IF EXISTS "Users can update own profile or admin can update status" ON public.profiles;
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

-- CONVERSATIONS:
--   SELECT: Allowed for non-suspended participants (active or restricted) or admins
--   INSERT: Strictly requires BOTH caller is `active` AND recipient is not `suspended` AND not blocked
--   UPDATE: Allowed for non-suspended participants (so restricted users can clear unread counts) or admins
DROP POLICY IF EXISTS "Participants can view their conversations" ON public.conversations;
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

DROP POLICY IF EXISTS "Participants can create conversations if not blocked" ON public.conversations;
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

DROP POLICY IF EXISTS "Participants can update their conversations" ON public.conversations;
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

-- CONVERSATION PARTICIPANTS:
--   SELECT: Non-suspended participants
--   INSERT: Strictly requires `is_current_user_active()`
DROP POLICY IF EXISTS "Participants can view conversation_participants" ON public.conversation_participants;
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

DROP POLICY IF EXISTS "Participants can insert conversation_participants" ON public.conversation_participants;
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

-- MESSAGES:
--   SELECT: Non-suspended participants (active or restricted) or admins
--   INSERT: Strictly requires `public.is_current_user_active()` (blocks both `restricted` and `suspended`)
--   UPDATE: Non-suspended participants or admins
DROP POLICY IF EXISTS "Conversation participants can read messages" ON public.messages;
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

DROP POLICY IF EXISTS "Conversation participants can send messages if not blocked" ON public.messages;
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

DROP POLICY IF EXISTS "Sender can soft-delete or recipient can mark read" ON public.messages;
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

-- NOTIFICATIONS:
--   INSERT: Only `active` accounts can create message notifications
DROP POLICY IF EXISTS "Authenticated users can create message notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create message notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_current_user_active()
  );

-- BLOCKS & REPORTS:
--   Prevent suspended accounts from submitting new blocks or reports
DROP POLICY IF EXISTS "Users can create blocks as blocker" ON public.blocks;
CREATE POLICY "Users can create blocks as blocker"
  ON public.blocks FOR INSERT
  TO authenticated
  WITH CHECK (
    blocker_id = auth.uid()
    AND public.is_current_user_not_suspended()
  );

DROP POLICY IF EXISTS "Authenticated users can submit reports" ON public.reports;
CREATE POLICY "Authenticated users can submit reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND status = 'pending'
    AND public.is_current_user_not_suspended()
  );

-- -----------------------------------------------------------------------------
-- 4. Enable Realtime on `public.profiles` so status changes push live to clients
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END
$$;
