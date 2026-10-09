import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  AccountStatus,
  BlockRecord,
  Conversation,
  Message,
  MessagingIdIndex,
  NotificationItem,
  ReportReason,
  ReportRecord,
  ReportStatus,
  UserPrivateConfig,
  UserProfile,
} from '../types/messaging';
import {
  AVATAR_PRESETS,
  generateRandom10DigitId,
  isValidMessagingIdFormat,
  sanitizeMessagingIdInput,
  sanitizeUsername,
} from '../utils/messagingId';

interface ProfileRow {
  id: string;
  display_name: string;
  username: string;
  messaging_id: string;
  avatar_url: string;
  bio: string;
  status: AccountStatus;
  is_admin: boolean;
  privacy_allow_id_lookup: boolean;
  privacy_show_read_receipts: boolean;
  notif_in_app: boolean;
  notif_sound: boolean;
  notif_preview: boolean;
  created_at: string;
  updated_at: string;
}

function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    uid: row.id,
    displayName: row.display_name,
    username: row.username,
    messagingId: row.messaging_id,
    avatarUrl: row.avatar_url || AVATAR_PRESETS[0],
    bio: row.bio || '',
    status: row.status || 'active',
    privacyAllowIdLookup: row.privacy_allow_id_lookup ?? true,
    privacyShowReadReceipts: row.privacy_show_read_receipts ?? true,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Ensures the signed-in Supabase Auth user has a row in `public.profiles`
 * with a unique random 10-digit Messaging ID.
 */
export async function ensureUserProfile(params: {
  uid: string;
  email: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
}): Promise<{
  profile: UserProfile;
  privateConfig: UserPrivateConfig;
  isAdmin: boolean;
}> {
  const { data: existing, error: fetchErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', params.uid)
    .maybeSingle();

  if (fetchErr && fetchErr.code !== 'PGRST116') {
    console.error('[CipherID Supabase Profile Fetch Error]', {
      code: fetchErr.code,
      message: fetchErr.message,
      details: fetchErr.details,
      hint: fetchErr.hint,
    });
    if (fetchErr.code === '42501') {
      throw new Error(
        `Database permission denied (RLS code ${fetchErr.code}): ${fetchErr.message}`
      );
    }
    throw new Error(
      `Supabase query error (${fetchErr.code || 'unknown'}): ${
        fetchErr.message || 'Unable to load user profile.'
      }`
    );
  }

  if (existing) {
    const row = existing as ProfileRow;
    return {
      profile: mapProfileRow(row),
      privateConfig: {
        uid: row.id,
        email: params.email,
        notifInApp: row.notif_in_app ?? true,
        notifSound: row.notif_sound ?? true,
        notifPreview: row.notif_preview ?? true,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      isAdmin: Boolean(row.is_admin),
    };
  }

  // Generate a collision-checked random 10-digit Messaging ID
  let allocatedId = '';
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateRandom10DigitId();
    const { data: conflict } = await supabase
      .from('profiles')
      .select('id')
      .eq('messaging_id', candidate)
      .maybeSingle();

    if (!conflict) {
      allocatedId = candidate;
      break;
    }
  }

  if (!allocatedId) {
    throw new Error('Could not generate a unique 10-digit Messaging ID. Please try again.');
  }

  const cleanDisplayName = (
    params.displayName ||
    params.email.split('@')[0] ||
    'Cipher User'
  )
    .trim()
    .slice(0, 60);

  let cleanUsername = sanitizeUsername(params.username || cleanDisplayName);
  const { data: usernameConflict } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', cleanUsername)
    .maybeSingle();

  if (usernameConflict) {
    cleanUsername = `${cleanUsername.slice(0, 24)}_${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('profiles')
    .insert({
      id: params.uid,
      display_name: cleanDisplayName,
      username: cleanUsername,
      messaging_id: allocatedId,
      avatar_url: params.avatarUrl || AVATAR_PRESETS[0],
      bio: (params.bio || 'Available on CipherID').slice(0, 160),
      status: 'active',
      is_admin: false,
      privacy_allow_id_lookup: true,
      privacy_show_read_receipts: true,
      notif_in_app: true,
      notif_sound: true,
      notif_preview: true,
    })
    .select('*')
    .single();

  if (insertErr || !inserted) {
    throw new Error(insertErr?.message || 'Failed to create user profile in Supabase.');
  }

  const row = inserted as ProfileRow;
  return {
    profile: mapProfileRow(row),
    privateConfig: {
      uid: row.id,
      email: params.email,
      notifInApp: row.notif_in_app ?? true,
      notifSound: row.notif_sound ?? true,
      notifPreview: row.notif_preview ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    isAdmin: Boolean(row.is_admin),
  };
}

/**
 * Uploads a profile picture file to Supabase Storage (`avatars` bucket)
 * and returns the public URL.
 */
export async function uploadProfileAvatar(uid: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? ext : 'png';
  const filePath = `${uid}/avatar_${Date.now()}.${safeExt}`;

  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadErr) {
    throw new Error(uploadErr.message || 'Failed to upload profile picture to Supabase Storage.');
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function updatePublicProfile(
  currentProfile: UserProfile,
  updates: {
    displayName: string;
    username: string;
    avatarUrl: string;
    bio: string;
    privacyAllowIdLookup: boolean;
    privacyShowReadReceipts: boolean;
  }
): Promise<void> {
  const cleanDisplayName =
    updates.displayName.trim().slice(0, 60) || currentProfile.displayName;
  const cleanUsername = sanitizeUsername(updates.username || currentProfile.username);
  const cleanAvatar = updates.avatarUrl.slice(0, 500);
  const cleanBio = updates.bio.trim().slice(0, 160);

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: cleanDisplayName,
      username: cleanUsername,
      avatar_url: cleanAvatar,
      bio: cleanBio,
      privacy_allow_id_lookup: Boolean(updates.privacyAllowIdLookup),
      privacy_show_read_receipts: Boolean(updates.privacyShowReadReceipts),
      updated_at: new Date().toISOString(),
    })
    .eq('id', currentProfile.uid);

  if (error) {
    throw new Error(error.message || 'Failed to update profile.');
  }
}

export async function updateNotificationSettings(
  uid: string,
  updates: {
    notifInApp: boolean;
    notifSound: boolean;
    notifPreview: boolean;
  }
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      notif_in_app: Boolean(updates.notifInApp),
      notif_sound: Boolean(updates.notifSound),
      notif_preview: Boolean(updates.notifPreview),
      updated_at: new Date().toISOString(),
    })
    .eq('id', uid);

  if (error) {
    throw new Error(error.message || 'Failed to update notification preferences.');
  }
}

/**
 * Searches `public.profiles` for an exact 10-digit Messaging ID match.
 * Never exposes email addresses or private credentials.
 */
export async function findUserByMessagingId(
  rawId: string
): Promise<MessagingIdIndex | null> {
  const cleanId = sanitizeMessagingIdInput(rawId);
  if (!isValidMessagingIdFormat(cleanId)) {
    throw new Error('Messaging ID must be exactly 10 numeric digits.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, display_name, username, messaging_id, avatar_url, bio, status, privacy_allow_id_lookup, created_at, updated_at'
    )
    .eq('messaging_id', cleanId)
    .eq('privacy_allow_id_lookup', true)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    messagingId: data.messaging_id,
    uid: data.id,
    displayName: data.display_name,
    username: data.username,
    avatarUrl: data.avatar_url || AVATAR_PRESETS[0],
    bio: data.bio || '',
    status: (data.status as AccountStatus) || 'active',
    allowLookup: Boolean(data.privacy_allow_id_lookup),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getPublicProfileByUid(uid: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle();

  if (error || !data) return null;
  return mapProfileRow(data as ProfileRow);
}

export async function getOrCreateConversation(
  currentUid: string,
  targetUid: string
): Promise<Conversation> {
  if (currentUid === targetUid) {
    throw new Error('You cannot start a conversation with your own Messaging ID.');
  }

  const [participantOneId, participantTwoId] = [currentUid, targetUid].sort();

  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('participant_one_id', participantOneId)
    .eq('participant_two_id', participantTwoId)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id,
      participantOneId: existing.participant_one_id,
      participantTwoId: existing.participant_two_id,
      participants: [existing.participant_one_id, existing.participant_two_id],
      lastMessageText: existing.last_message_text || '',
      lastMessageSenderId: existing.last_message_sender_id || '',
      lastMessageAt: existing.last_message_at || existing.updated_at,
      unreadCountOne: Number(existing.unread_count_one || 0),
      unreadCountTwo: Number(existing.unread_count_two || 0),
      createdAt: existing.created_at,
      updatedAt: existing.updated_at,
    };
  }

  const { data: created, error: createErr } = await supabase
    .from('conversations')
    .insert({
      participant_one_id: participantOneId,
      participant_two_id: participantTwoId,
      last_message_text: '',
      unread_count_one: 0,
      unread_count_two: 0,
    })
    .select('*')
    .single();

  if (createErr || !created) {
    throw new Error(
      createErr?.message ||
        'Could not create conversation. Check if either user has blocked the other.'
    );
  }

  // Record participants in conversation_participants relational table
  await supabase.from('conversation_participants').insert([
    { conversation_id: created.id, user_id: participantOneId },
    { conversation_id: created.id, user_id: participantTwoId },
  ]);

  return {
    id: created.id,
    participantOneId: created.participant_one_id,
    participantTwoId: created.participant_two_id,
    participants: [created.participant_one_id, created.participant_two_id],
    lastMessageText: created.last_message_text || '',
    lastMessageSenderId: created.last_message_sender_id || '',
    lastMessageAt: created.last_message_at || created.updated_at,
    unreadCountOne: Number(created.unread_count_one || 0),
    unreadCountTwo: Number(created.unread_count_two || 0),
    createdAt: created.created_at,
    updatedAt: created.updated_at,
  };
}

export async function sendMessage(params: {
  conversation: Conversation;
  senderProfile: UserProfile;
  content: string;
  replyTo?: { id: string; text: string; senderName: string } | null;
}): Promise<void> {
  const cleanContent = params.content.trim().slice(0, 2000);
  if (!cleanContent) return;

  const { conversation, senderProfile, replyTo } = params;
  const isSenderOne = conversation.participantOneId === senderProfile.uid;
  const recipientUid = isSenderOne
    ? conversation.participantTwoId
    : conversation.participantOneId;

  const { error: msgErr } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    sender_id: senderProfile.uid,
    content: cleanContent,
    reply_to_id: replyTo?.id || null,
    reply_to_text: (replyTo?.text || '').slice(0, 300),
    reply_to_sender_name: (replyTo?.senderName || '').slice(0, 60),
    status: 'sent',
  });

  if (msgErr) {
    throw new Error(msgErr.message || 'Failed to send message.');
  }

  const nowIso = new Date().toISOString();

  await supabase
    .from('conversations')
    .update({
      last_message_text: cleanContent.slice(0, 1000),
      last_message_sender_id: senderProfile.uid,
      last_message_at: nowIso,
      unread_count_one: isSenderOne
        ? conversation.unreadCountOne
        : (conversation.unreadCountOne || 0) + 1,
      unread_count_two: isSenderOne
        ? (conversation.unreadCountTwo || 0) + 1
        : conversation.unreadCountTwo,
      updated_at: nowIso,
    })
    .eq('id', conversation.id);

  await supabase.from('notifications').insert({
    user_id: recipientUid,
    sender_id: senderProfile.uid,
    type: 'message',
    title: `New message from ${senderProfile.displayName.slice(0, 60)}`,
    body: cleanContent.slice(0, 240),
    reference_id: conversation.id,
    read: false,
  });
}

export async function deleteOwnMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({
      content: 'Message deleted',
      deleted_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .eq('conversation_id', conversationId);

  if (error) {
    throw new Error(error.message || 'Failed to delete message.');
  }
}

export async function markConversationRead(
  conversation: Conversation,
  currentUid: string,
  unreadMessagesFromOther: Message[],
  shareReadReceipts: boolean
): Promise<void> {
  const isParticipantOne = conversation.participantOneId === currentUid;
  const currentUnread = isParticipantOne
    ? conversation.unreadCountOne
    : conversation.unreadCountTwo;

  if (currentUnread > 0) {
    await supabase
      .from('conversations')
      .update(
        isParticipantOne
          ? { unread_count_one: 0, updated_at: new Date().toISOString() }
          : { unread_count_two: 0, updated_at: new Date().toISOString() }
      )
      .eq('id', conversation.id);
  }

  if (shareReadReceipts) {
    const unreadIds = unreadMessagesFromOther
      .filter((m) => m.senderId !== currentUid && m.status !== 'read' && !m.isDeleted)
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      await supabase
        .from('messages')
        .update({
          status: 'read',
          read_at: new Date().toISOString(),
        })
        .in('id', unreadIds);
    }
  }
}

export async function blockUser(params: {
  blockerId: string;
  blockedId: string;
  blockedMessagingId: string;
  blockedDisplayName: string;
}): Promise<void> {
  const { error } = await supabase.from('blocks').insert({
    blocker_id: params.blockerId,
    blocked_id: params.blockedId,
  });
  if (error && error.code !== '23505') {
    throw new Error(error.message || 'Failed to block user.');
  }
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);

  if (error) {
    throw new Error(error.message || 'Failed to unblock user.');
  }
}

export async function submitModerationReport(params: {
  reporterId: string;
  reportedUserId: string;
  reportedMessagingId: string;
  messageId?: string;
  reason: ReportReason;
  description: string;
}): Promise<void> {
  const cleanDesc =
    params.description.trim().slice(0, 1000) || `Reported for ${params.reason}`;

  const { error } = await supabase.from('reports').insert({
    reporter_id: params.reporterId,
    reported_user_id: params.reportedUserId,
    message_id: params.messageId || null,
    reason: params.reason,
    description: cleanDesc,
    status: 'pending',
  });

  if (error) {
    throw new Error(error.message || 'Failed to submit report.');
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
}

// ---------------------------------------------------------------------------
// Supabase Realtime Subscriptions
// ---------------------------------------------------------------------------

export function subscribeToUserConversations(
  uid: string,
  onUpdate: (conversations: Conversation[]) => void
): () => void {
  const fetchConversations = async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_one_id.eq.${uid},participant_two_id.eq.${uid}`)
      .order('last_message_at', { ascending: false });

    if (data) {
      onUpdate(
        data.map((row) => ({
          id: row.id,
          participantOneId: row.participant_one_id,
          participantTwoId: row.participant_two_id,
          participants: [row.participant_one_id, row.participant_two_id],
          lastMessageText: row.last_message_text || '',
          lastMessageSenderId: row.last_message_sender_id || '',
          lastMessageAt: row.last_message_at || row.updated_at,
          unreadCountOne: Number(row.unread_count_one || 0),
          unreadCountTwo: Number(row.unread_count_two || 0),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      );
    }
  };

  fetchConversations();

  const channel: RealtimeChannel = supabase
    .channel(`conversations:${uid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
      },
      () => {
        fetchConversations();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToConversationMessages(
  conversationId: string,
  messageLimit: number,
  onUpdate: (messages: Message[]) => void
): () => void {
  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(messageLimit);

    if (data) {
      onUpdate(
        data.map((row) => ({
          id: row.id,
          conversationId: row.conversation_id,
          senderId: row.sender_id,
          content: row.deleted_at ? 'Message deleted' : row.content,
          replyToId: row.reply_to_id || '',
          replyToText: row.reply_to_text || '',
          replyToSenderName: row.reply_to_sender_name || '',
          status: row.read_at ? 'read' : row.status || 'sent',
          isDeleted: Boolean(row.deleted_at),
          createdAt: row.created_at,
          updatedAt: row.read_at || row.deleted_at || row.created_at,
        }))
      );
    }
  };

  fetchMessages();

  const channel: RealtimeChannel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      () => {
        fetchMessages();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToUserBlocks(
  uid: string,
  onUpdate: (blocksByMe: BlockRecord[], blockedMeUids: Set<string>) => void
): () => void {
  const fetchBlocks = async () => {
    const { data } = await supabase
      .from('blocks')
      .select(
        'id, blocker_id, blocked_id, created_at, blocked:profiles!blocks_blocked_id_fkey(display_name, messaging_id)'
      )
      .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);

    if (!data) return;

    const myBlocks: BlockRecord[] = [];
    const againstMe = new Set<string>();

    data.forEach((row: Record<string, unknown>) => {
      if (row.blocker_id === uid) {
        const blockedProfile = row.blocked as
          | { display_name?: string; messaging_id?: string }
          | undefined;
        myBlocks.push({
          id: String(row.id),
          blockerId: String(row.blocker_id),
          blockedId: String(row.blocked_id),
          blockedMessagingId: blockedProfile?.messaging_id || '0000000000',
          blockedDisplayName: blockedProfile?.display_name || 'Blocked User',
          createdAt: String(row.created_at),
        });
      } else if (row.blocked_id === uid) {
        againstMe.add(String(row.blocker_id));
      }
    });

    onUpdate(myBlocks, againstMe);
  };

  fetchBlocks();

  const channel: RealtimeChannel = supabase
    .channel(`blocks:${uid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'blocks',
      },
      () => {
        fetchBlocks();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToUserNotifications(
  uid: string,
  onUpdate: (notifications: NotificationItem[]) => void
): () => void {
  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(40);

    if (data) {
      onUpdate(
        data.map((row) => ({
          id: row.id,
          userId: row.user_id,
          senderId: row.sender_id || '',
          type: row.type || 'message',
          title: row.title || 'New Message',
          body: row.body || '',
          referenceId: row.reference_id || '',
          read: Boolean(row.read),
          createdAt: row.created_at,
          updatedAt: row.created_at,
        }))
      );
    }
  };

  fetchNotifications();

  const channel: RealtimeChannel = supabase
    .channel(`notifications:${uid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${uid}`,
      },
      () => {
        fetchNotifications();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

function mapReportRow(row: Record<string, unknown>): ReportRecord {
  const reporterRaw = row.reporter;
  const reporter = (Array.isArray(reporterRaw) ? reporterRaw[0] : reporterRaw) as
    | {
        display_name?: string;
        username?: string;
        messaging_id?: string;
        avatar_url?: string;
      }
    | undefined;

  const reportedRaw = row.reported;
  const reported = (Array.isArray(reportedRaw) ? reportedRaw[0] : reportedRaw) as
    | {
        display_name?: string;
        username?: string;
        messaging_id?: string;
        avatar_url?: string;
        status?: AccountStatus;
      }
    | undefined;

  const messageRaw = row.related_message;
  const relatedMessage = (Array.isArray(messageRaw) ? messageRaw[0] : messageRaw) as
    | {
        content?: string;
        deleted_at?: string | null;
      }
    | undefined;

  return {
    id: String(row.id),
    reporterId: String(row.reporter_id || ''),
    reporterMessagingId: reporter?.messaging_id || '0000000000',
    reporterDisplayName: reporter?.display_name || 'Unknown Reporter',
    reporterUsername: reporter?.username || 'unknown',
    reporterAvatarUrl: reporter?.avatar_url || AVATAR_PRESETS[0],
    reportedUserId: String(row.reported_user_id || ''),
    reportedMessagingId: reported?.messaging_id || '0000000000',
    reportedDisplayName: reported?.display_name || 'Unknown User',
    reportedUsername: reported?.username || 'unknown',
    reportedAvatarUrl: reported?.avatar_url || AVATAR_PRESETS[0],
    reportedAccountStatus: reported?.status || 'active',
    messageId: row.message_id ? String(row.message_id) : '',
    messageContent: relatedMessage?.content || '',
    reason: (row.reason as ReportReason) || 'Other',
    description: String(row.description || ''),
    status: (row.status as ReportStatus) || 'pending',
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
  };
}

export function subscribeToUserReports(
  uid: string,
  onUpdate: (reports: ReportRecord[]) => void
): () => void {
  const fetchReports = async () => {
    const { data, error } = await supabase
      .from('reports')
      .select(
        `id, reporter_id, reported_user_id, message_id, reason, description, status, created_at, updated_at,
         reporter:profiles!reports_reporter_id_fkey(display_name, username, messaging_id, avatar_url),
         reported:profiles!reports_reported_user_id_fkey(display_name, username, messaging_id, avatar_url, status),
         related_message:messages!reports_message_id_fkey(content, deleted_at)`
      )
      .eq('reporter_id', uid)
      .order('created_at', { ascending: false });

    if (!error && data) {
      onUpdate(data.map((row: Record<string, unknown>) => mapReportRow(row)));
      return;
    }

    // Fallback query if foreign key aliases differ
    const { data: plainData } = await supabase
      .from('reports')
      .select('*')
      .eq('reporter_id', uid)
      .order('created_at', { ascending: false });

    if (plainData) {
      onUpdate(plainData.map((row: Record<string, unknown>) => mapReportRow(row)));
    }
  };

  fetchReports();

  const channel: RealtimeChannel = supabase
    .channel(`user-reports:${uid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reports',
        filter: `reporter_id=eq.${uid}`,
      },
      () => {
        fetchReports();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Administrator Functions (Enforced by Supabase PostgreSQL RLS)
// ---------------------------------------------------------------------------

export async function adminFetchAllUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(250);

  if (error || !data) {
    throw new Error(error?.message || 'Failed to load user profiles.');
  }

  return data.map((row) => mapProfileRow(row as ProfileRow));
}

export async function adminFetchAllReports(): Promise<ReportRecord[]> {
  const { data, error } = await supabase
    .from('reports')
    .select(
      `id, reporter_id, reported_user_id, message_id, reason, description, status, created_at, updated_at,
       reporter:profiles!reports_reporter_id_fkey(display_name, username, messaging_id, avatar_url),
       reported:profiles!reports_reported_user_id_fkey(display_name, username, messaging_id, avatar_url, status),
       related_message:messages!reports_message_id_fkey(content, deleted_at)`
    )
    .order('created_at', { ascending: false })
    .limit(250);

  if (!error && data) {
    return data.map((row: Record<string, unknown>) => mapReportRow(row));
  }

  // Graceful fallback if relational join fails: fetch reports and profiles separately
  const { data: plainReports, error: plainErr } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(250);

  if (plainErr || !plainReports) {
    throw new Error(plainErr?.message || error?.message || 'Failed to load moderation reports.');
  }

  const userIds = Array.from(
    new Set(
      plainReports
        .flatMap((r) => [String(r.reporter_id || ''), String(r.reported_user_id || '')])
        .filter(Boolean)
    )
  );

  const profileMap = new Map<string, ProfileRow>();
  if (userIds.length > 0) {
    const { data: profData } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);
    (profData || []).forEach((p) => {
      profileMap.set(p.id, p as ProfileRow);
    });
  }

  return plainReports.map((row: Record<string, unknown>) => {
    const reporterProf = profileMap.get(String(row.reporter_id || ''));
    const reportedProf = profileMap.get(String(row.reported_user_id || ''));
    return mapReportRow({
      ...row,
      reporter: reporterProf,
      reported: reportedProf,
    });
  });
}

export function subscribeToAdminReports(
  onUpdate: (reports: ReportRecord[]) => void
): () => void {
  const refresh = () => {
    adminFetchAllReports()
      .then((list) => onUpdate(list))
      .catch(() => {});
  };

  refresh();

  const channel: RealtimeChannel = supabase
    .channel('admin-reports-watch')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reports',
      },
      () => {
        refresh();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function adminUpdateUserStatus(
  userProfile: UserProfile,
  newStatus: AccountStatus
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userProfile.uid);

  if (error) {
    throw new Error(error.message || 'Failed to update account standing.');
  }
}

export async function adminUpdateReportStatus(
  reportId: string,
  newStatus: ReportStatus
): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  if (error) {
    throw new Error(error.message || 'Failed to update report status.');
  }
}
