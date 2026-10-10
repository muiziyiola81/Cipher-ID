/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import {
  AlertTriangle,
  Ban,
  Bell,
  Check,
  Copy,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  BlockRecord,
  Conversation,
  Message,
  MessagingIdIndex,
  NotificationItem,
  ReportRecord,
  UserPrivateConfig,
  UserProfile,
} from './types/messaging';
import {
  blockUser,
  ensureUserProfile,
  getOrCreateConversation,
  getPublicProfileByUid,
  markNotificationAsRead,
  subscribeToAdminReports,
  subscribeToOwnProfile,
  subscribeToUserBlocks,
  subscribeToUserConversations,
  subscribeToUserNotifications,
  subscribeToUserReports,
  unblockUser,
} from './services/messagingService';
import { formatMessagingIdDisplay } from './utils/messagingId';
import { LandingPage } from './components/LandingPage';
import { AuthScreenMode, AuthScreens } from './components/AuthScreens';
import { LegalModal } from './components/LegalModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { UserAvatar } from './components/UserAvatar';
import { FindUserModal } from './components/FindUserModal';
import { ChatView } from './components/ChatView';
import { UserProfileModal } from './components/UserProfileModal';
import { ReportModal } from './components/ReportModal';
import { SettingsView } from './components/SettingsView';
import { AdminDashboard } from './components/AdminDashboard';

type MainTab = 'chats' | 'people' | 'settings' | 'admin';

function formatRelativeTime(iso: string): string {
  try {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [sbUser, setSbUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateConfig, setPrivateConfig] = useState<UserPrivateConfig | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Unauthenticated Navigation
  const [authScreen, setAuthScreen] = useState<AuthScreenMode | null>(null);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy' | 'about' | null>(null);

  // Authenticated Workspace State
  const [activeTab, setActiveTab] = useState<MainTab>('chats');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [peerProfiles, setPeerProfiles] = useState<Record<string, UserProfile>>({});
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  // Blocks, Notifications, Reports
  const [blocksByMe, setBlocksByMe] = useState<BlockRecord[]>([]);
  const [blockedMeUids, setBlockedMeUids] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [myReports, setMyReports] = useState<ReportRecord[]>([]);
  const [adminReports, setAdminReports] = useState<ReportRecord[]>([]);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);

  // Modals
  const [showFindUserModal, setShowFindUserModal] = useState(false);
  const [inspectingUser, setInspectingUser] = useState<UserProfile | null>(null);
  const [reportingTarget, setReportingTarget] = useState<{
    user: UserProfile;
    message?: Message;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedHeaderId, setCopiedHeaderId] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'login') setAuthScreen('login');
    if (params.get('mode') === 'signup') setAuthScreen('signup');
  }, []);

  // 1. Listen to Supabase Auth session state
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      return;
    }

    const hydrateUser = async (user: SupabaseUser | null) => {
      setSbUser(user);
      setAuthReady(true);

      if (!user) {
        setProfile(null);
        setPrivateConfig(null);
        setIsAdmin(false);
        setConversations([]);
        setSelectedConversationId(null);
        return;
      }

      setProfileLoading(true);
      setInitError(null);
      try {
        const meta = user.user_metadata || {};
        const ensured = await ensureUserProfile({
          uid: user.id,
          email: user.email || 'user@cipherid.app',
          displayName: meta.display_name || undefined,
          username: meta.username || undefined,
        });
        setProfile(ensured.profile);
        setPrivateConfig(ensured.privateConfig);
        setIsAdmin(ensured.isAdmin);
      } catch (err: unknown) {
        setInitError(
          err instanceof Error
            ? err.message
            : 'Failed to initialize your 10-digit Messaging ID profile in Supabase.'
        );
      } finally {
        setProfileLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      hydrateUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2. Attach real-time Supabase listeners once authenticated and profile is ready
  useEffect(() => {
    if (!authReady || !sbUser || !profile) return;

    const unsubOwnProfile = subscribeToOwnProfile(
      profile.uid,
      (liveOwnProfile, liveIsAdmin) => {
        setProfile(liveOwnProfile);
        setIsAdmin(liveIsAdmin);
      }
    );

    const unsubConvs = subscribeToUserConversations(profile.uid, (liveConvs) => {
      setConversations(liveConvs);
    });

    const unsubBlocks = subscribeToUserBlocks(
      profile.uid,
      (myBlockList, againstMeSet) => {
        setBlocksByMe(myBlockList);
        setBlockedMeUids(againstMeSet);
      }
    );

    const unsubNotifs = subscribeToUserNotifications(profile.uid, (liveNotifs) => {
      setNotifications(liveNotifs);
    });

    const unsubReports = subscribeToUserReports(profile.uid, (liveReports) => {
      setMyReports(liveReports);
    });

    const unsubAdminReports = isAdmin
      ? subscribeToAdminReports((allReports) => {
          setAdminReports(allReports);
        })
      : () => {};

    return () => {
      unsubOwnProfile();
      unsubConvs();
      unsubBlocks();
      unsubNotifs();
      unsubReports();
      unsubAdminReports();
    };
  }, [authReady, sbUser, profile?.uid, isAdmin]);

  // 3. Hydrate peer profiles for conversations
  useEffect(() => {
    if (!profile || conversations.length === 0) return;

    conversations.forEach((conv) => {
      const otherUid =
        conv.participantOneId === profile.uid
          ? conv.participantTwoId
          : conv.participantOneId;

      if (!peerProfiles[otherUid]) {
        getPublicProfileByUid(otherUid).then((peer) => {
          if (peer) {
            setPeerProfiles((prev) => ({ ...prev, [otherUid]: peer }));
          }
        });
      }
    });
  }, [conversations, profile, peerProfiles]);

  const blockedByMeSet = useMemo(
    () => new Set(blocksByMe.map((b) => b.blockedId)),
    [blocksByMe]
  );

  const totalUnreadMessages = useMemo(() => {
    if (!profile) return 0;
    return conversations.reduce((acc, conv) => {
      const count =
        conv.participantOneId === profile.uid
          ? conv.unreadCountOne
          : conv.unreadCountTwo;
      return acc + (count || 0);
    }, 0);
  }, [conversations, profile]);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read),
    [notifications]
  );

  const filteredConversations = useMemo(() => {
    if (!profile) return [];
    const q = chatSearchQuery.trim().toLowerCase();
    if (!q) return conversations;

    return conversations.filter((conv) => {
      const otherUid =
        conv.participantOneId === profile.uid
          ? conv.participantTwoId
          : conv.participantOneId;
      const peer = peerProfiles[otherUid];
      const matchName = peer?.displayName?.toLowerCase().includes(q);
      const matchUsername = peer?.username?.toLowerCase().includes(q);
      const matchId = peer?.messagingId?.includes(q);
      const matchLastMsg = conv.lastMessageText?.toLowerCase().includes(q);
      return Boolean(matchName || matchUsername || matchId || matchLastMsg);
    });
  }, [conversations, peerProfiles, profile, chatSearchQuery]);

  const knownPeople = useMemo(() => {
    if (!profile) return [];
    const list: UserProfile[] = [];
    const seen = new Set<string>();
    conversations.forEach((conv) => {
      const otherUid =
        conv.participantOneId === profile.uid
          ? conv.participantTwoId
          : conv.participantOneId;
      const peer = peerProfiles[otherUid];
      if (peer && !seen.has(peer.uid)) {
        seen.add(peer.uid);
        list.push(peer);
      }
    });
    return list;
  }, [conversations, peerProfiles, profile]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const activeOtherUser = useMemo(() => {
    if (!activeConversation || !profile) return null;
    const otherUid =
      activeConversation.participantOneId === profile.uid
        ? activeConversation.participantTwoId
        : activeConversation.participantOneId;
    return peerProfiles[otherUid] || null;
  }, [activeConversation, peerProfiles, profile]);

  const handleStartConversationWithUser = async (target: MessagingIdIndex) => {
    if (!profile) return;
    if (profile.status !== 'active') {
      showToast(
        profile.status === 'restricted'
          ? 'Your account is restricted and cannot start new conversations.'
          : 'Your account is suspended and cannot use messaging features.'
      );
      throw new Error(
        profile.status === 'restricted'
          ? 'Your account is currently restricted and cannot start new conversations.'
          : 'Your account has been suspended and cannot use messaging features.'
      );
    }
    const peerProfile: UserProfile = {
      uid: target.uid,
      displayName: target.displayName,
      username: target.username,
      messagingId: target.messagingId,
      avatarUrl: target.avatarUrl,
      bio: target.bio,
      status: target.status,
      privacyAllowIdLookup: target.allowLookup,
      privacyShowReadReceipts: true,
      createdAt: target.createdAt,
      updatedAt: target.updatedAt,
    };
    setPeerProfiles((prev) => ({ ...prev, [target.uid]: peerProfile }));

    const conv = await getOrCreateConversation(profile.uid, target.uid);
    setConversations((prev) => {
      if (prev.some((c) => c.id === conv.id)) return prev;
      return [conv, ...prev];
    });
    setSelectedConversationId(conv.id);
    setActiveTab('chats');
  };

  const handleToggleBlockUser = async (targetUser: UserProfile) => {
    if (!profile) return;
    const currentlyBlocked = blockedByMeSet.has(targetUser.uid);
    if (currentlyBlocked) {
      await unblockUser(profile.uid, targetUser.uid);
      showToast(`Unblocked ${targetUser.displayName}`);
    } else {
      await blockUser({
        blockerId: profile.uid,
        blockedId: targetUser.uid,
        blockedMessagingId: targetUser.messagingId,
        blockedDisplayName: targetUser.displayName,
      });
      showToast(`Blocked ${targetUser.displayName}`);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthScreen(null);
    showToast('Signed out of CipherID');
  };

  const handleCopyOwnHeaderId = () => {
    if (!profile) return;
    navigator.clipboard.writeText(profile.messagingId).catch(() => {});
    setCopiedHeaderId(true);
    showToast('Copied your 10-digit Messaging ID');
    setTimeout(() => setCopiedHeaderId(false), 2000);
  };

  // Splash Screen while Supabase Auth initializes
  if (!authReady || profileLoading) {
    return (
      <div className="min-h-screen bg-[#090A0F] text-[#F8FAFC] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#11131C] border border-[#06B6D4]/40 flex items-center justify-center mx-auto">
            <MessageSquare className="w-6 h-6 text-[#06B6D4] animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="font-display text-lg font-bold text-white">CipherID</div>
            <p className="text-xs text-[#94A3B8]">
              {profileLoading
                ? 'Verifying your unique 10-digit Messaging ID...'
                : 'Initializing secure session...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error recovery state (never leave stuck on loading)
  if (sbUser && initError && !profile) {
    return (
      <div className="min-h-screen bg-[#090A0F] text-[#F8FAFC] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl bg-[#11131C] border border-white/10 p-6 text-center space-y-4">
          <div className="text-base font-semibold text-white">
            Connection or Profile Sync Issue
          </div>
          <p className="text-xs text-[#94A3B8] leading-relaxed">{initError}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#06B6D4] text-[#090A0F] text-xs font-semibold"
            >
              Retry Connection
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#161926] border border-white/10 text-xs font-semibold text-white"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated View: Landing Page or Auth Screens
  if (!sbUser || !profile || !privateConfig) {
    return (
      <>
        <OfflineIndicator />
        {authScreen ? (
          <AuthScreens
            mode={authScreen}
            onChangeMode={setAuthScreen}
            onBackToLanding={() => setAuthScreen(null)}
          />
        ) : (
          <LandingPage
            onOpenAuth={(mode) => setAuthScreen(mode)}
            onOpenLegal={(tab) => setLegalTab(tab)}
          />
        )}
        <LegalModal tab={legalTab} onClose={() => setLegalTab(null)} />
      </>
    );
  }

  // Suspended Account Guard
  if (profile.status === 'suspended' && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#090A0F] text-[#F8FAFC] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl bg-[#11131C] border border-[#EF4444]/40 p-6 text-center space-y-4">
          <Ban className="w-10 h-10 text-[#EF4444] mx-auto" />
          <h1 className="text-lg font-bold text-white">Account Suspended</h1>
          <p className="text-xs text-[#94A3B8]">
            Your 10-digit Messaging ID ({formatMessagingIdDisplay(profile.messagingId)}) has been suspended by an administrator following a moderation review.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="min-h-[44px] px-6 py-2 rounded-xl bg-[#161926] border border-white/10 text-xs font-semibold text-white"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Authenticated Messaging Workspace
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#090A0F] text-[#F8FAFC] flex flex-col lg:flex-row">
      <OfflineIndicator />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 lg:bottom-6 right-4 z-50 rounded-xl bg-[#11131C] border border-[#06B6D4]/50 px-4 py-2.5 text-xs font-medium text-white shadow-2xl flex items-center gap-2"
        >
          <Check className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Desktop Left Navigation Rail */}
      <aside className="hidden lg:flex w-64 flex-col justify-between bg-[#11131C] border-r border-white/[0.07] p-4 shrink-0">
        <div className="space-y-6">
          {/* Brand + Notification Trigger */}
          <div className="flex items-center justify-between px-2">
            <span className="font-display text-lg font-bold tracking-tight text-white">
              CipherID
            </span>
            <button
              type="button"
              onClick={() => setShowNotificationsDrawer((prev) => !prev)}
              aria-label="Toggle in-app notifications"
              className="relative min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#06B6D4]" />
              )}
            </button>
          </div>

          {/* Own 10-Digit Messaging ID Card */}
          <div className="rounded-2xl bg-[#161926] border border-white/[0.07] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
              <span>My 10-Digit ID</span>
              <button
                type="button"
                onClick={handleCopyOwnHeaderId}
                className="text-[#06B6D4] hover:underline flex items-center gap-1 font-medium"
              >
                {copiedHeaderId ? (
                  <>
                    <Check className="w-3 h-3 text-[#10B981]" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="font-mono text-sm font-semibold text-white tracking-wider tabular-nums">
              {formatMessagingIdDisplay(profile.messagingId)}
            </div>
          </div>

          {/* Primary Action: New Chat by 10-Digit ID */}
          <button
            type="button"
            onClick={() => setShowFindUserModal(true)}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#06B6D4] text-[#090A0F] font-semibold text-xs hover:bg-[#22D3EE] transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat by 10-Digit ID</span>
          </button>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab('chats')}
              className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                activeTab === 'chats'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4 text-[#06B6D4]" />
                <span>Chats</span>
              </span>
              {totalUnreadMessages > 0 && (
                <span className="font-mono text-xs text-[#06B6D4] tabular-nums">
                  {totalUnreadMessages}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('people')}
              className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                activeTab === 'people'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-3">
                <Users className="w-4 h-4 text-[#06B6D4]" />
                <span>People</span>
              </span>
              <span className="font-mono text-xs text-[#64748B] tabular-nums">
                {knownPeople.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-3 transition-colors ${
                activeTab === 'settings'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings className="w-4 h-4 text-[#06B6D4]" />
              <span>Profile &amp; Settings</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                  activeTab === 'admin'
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-[#06B6D4]" />
                  <span>Admin Dashboard</span>
                </span>
                {adminReports.filter((r) => r.status === 'pending').length > 0 && (
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[#F59E0B]/20 text-[#F59E0B] font-bold tabular-nums">
                    {adminReports.filter((r) => r.status === 'pending').length}
                  </span>
                )}
              </button>
            )}
          </nav>
        </div>

        {/* Bottom Current User Mini Card */}
        <div className="pt-4 border-t border-white/[0.07] space-y-3">
          <PWAInstallButton variant="compact" />
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors text-left"
          >
            <UserAvatar
              avatarUrl={profile.avatarUrl}
              displayName={profile.displayName}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">
                {profile.displayName}
              </div>
              <div className="text-[11px] text-[#94A3B8] truncate">
                @{profile.username}
              </div>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Account Restricted Standing Banner */}
        {profile.status === 'restricted' && (
          <div
            role="alert"
            className="bg-[#F59E0B]/15 border-b border-[#F59E0B]/40 px-4 py-2.5 text-xs text-[#F59E0B] flex items-center justify-center gap-2.5 shrink-0"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>Account Restricted:</strong> Your account is currently under a messaging restriction. You can view your existing conversations, but sending new messages and starting new chats are disabled.
            </span>
          </div>
        )}

        {/* Mobile Top App Bar */}
        {!(activeTab === 'chats' && selectedConversationId) && (
          <header className="lg:hidden h-14 px-4 bg-[#11131C]/90 backdrop-blur-md border-b border-white/[0.07] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-display text-base font-bold text-white">
                CipherID
              </span>
              <span aria-hidden="true" className="text-[#64748B]">·</span>
              <button
                type="button"
                onClick={handleCopyOwnHeaderId}
                className="font-mono text-xs text-[#06B6D4] truncate tabular-nums flex items-center gap-1"
              >
                <span>{formatMessagingIdDisplay(profile.messagingId)}</span>
                <Copy className="w-3 h-3 shrink-0" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowNotificationsDrawer((prev) => !prev)}
                aria-label="Open notifications"
                className="relative min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-white"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#06B6D4]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowFindUserModal(true)}
                aria-label="Find User by 10-Digit ID"
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#06B6D4] text-[#090A0F] text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Chat</span>
              </button>
            </div>
          </header>
        )}

        {/* In-App Notifications Drawer Overlay */}
        {showNotificationsDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-[#11131C] border-l border-white/10 h-full flex flex-col p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#06B6D4]" />
                  <h2 className="text-sm font-semibold text-white">
                    In-App Notifications ({unreadNotifications.length} unread)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotificationsDrawer(false)}
                  aria-label="Close notifications drawer"
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#94A3B8]">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        if (!n.read) markNotificationAsRead(n.id);
                        if (n.type === 'message' && n.referenceId) {
                          setSelectedConversationId(n.referenceId);
                          setActiveTab('chats');
                        }
                        setShowNotificationsDrawer(false);
                      }}
                      className={`w-full text-left rounded-2xl p-3.5 border transition-colors space-y-1 ${
                        n.read
                          ? 'bg-[#161926]/60 border-white/[0.05] text-[#94A3B8]'
                          : 'bg-[#161926] border-[#06B6D4]/40 text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold truncate">{n.title}</span>
                        <span className="font-mono text-[11px] text-[#64748B] tabular-nums shrink-0 ml-2">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>
                      {privateConfig.notifPreview && (
                        <p className="text-xs text-[#94A3B8] truncate">{n.body}</p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Routing */}
        {activeTab === 'chats' && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Conversation List Column */}
            <div
              className={`${
                selectedConversationId ? 'hidden lg:flex' : 'flex'
              } w-full lg:w-80 xl:w-96 flex-col border-r border-white/[0.07] bg-[#090A0F] shrink-0`}
            >
              <div className="p-4 border-b border-white/[0.07] space-y-3">
                <div className="flex items-center justify-between">
                  <h1 className="font-display text-lg font-bold text-white">
                    Conversations
                  </h1>
                  <button
                    type="button"
                    onClick={() => setShowFindUserModal(true)}
                    className="hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold text-[#06B6D4] hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Find ID</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    placeholder="Filter chats or 10-digit IDs..."
                    className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl bg-[#11131C] border border-white/10 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-white/[0.05] pb-20 lg:pb-0">
                {filteredConversations.length === 0 ? (
                  <div className="p-8 text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#11131C] border border-white/10 flex items-center justify-center mx-auto">
                      <MessageSquare className="w-5 h-5 text-[#06B6D4]" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-white">
                        {chatSearchQuery ? 'No matching chats' : 'No conversations yet'}
                      </div>
                      <p className="text-xs text-[#94A3B8] leading-relaxed">
                        {chatSearchQuery
                          ? 'Try searching by another display name or 10-digit Messaging ID.'
                          : 'Enter another user’s 10-digit Messaging ID to start a private real-time conversation.'}
                      </p>
                    </div>
                    {!chatSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setShowFindUserModal(true)}
                        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#06B6D4] text-[#090A0F] font-semibold text-xs hover:bg-[#22D3EE] transition-colors inline-flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Find User by 10-Digit ID</span>
                      </button>
                    )}
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    const otherUid =
                      conv.participantOneId === profile.uid
                        ? conv.participantTwoId
                        : conv.participantOneId;
                    const peer = peerProfiles[otherUid] || {
                      uid: otherUid,
                      displayName: 'CipherID User',
                      username: 'user',
                      messagingId: '0000000000',
                      avatarUrl: 'obsidian-cyan',
                      bio: '',
                      status: 'active',
                      privacyAllowIdLookup: true,
                      privacyShowReadReceipts: true,
                      createdAt: conv.createdAt,
                      updatedAt: conv.updatedAt,
                    };

                    const unread =
                      conv.participantOneId === profile.uid
                        ? conv.unreadCountOne
                        : conv.unreadCountTwo;
                    const isSelected = conv.id === selectedConversationId;
                    const isBlocked = blockedByMeSet.has(otherUid);

                    return (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => setSelectedConversationId(conv.id)}
                        className={`w-full px-4 py-3.5 flex items-center gap-3.5 text-left transition-colors ${
                          isSelected
                            ? 'bg-[#161926]'
                            : 'hover:bg-[#11131C]'
                        }`}
                      >
                        <UserAvatar
                          avatarUrl={peer.avatarUrl}
                          displayName={peer.displayName}
                          size="md"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-white truncate">
                              {peer.displayName}
                            </span>
                            <span className="font-mono text-[11px] text-[#64748B] tabular-nums shrink-0">
                              {formatRelativeTime(conv.lastMessageAt)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-[#94A3B8] truncate">
                              {isBlocked
                                ? 'Blocked user'
                                : conv.lastMessageText ||
                                  `ID ${formatMessagingIdDisplay(peer.messagingId)}`}
                            </p>
                            {unread > 0 && (
                              <span className="font-mono text-xs font-semibold text-[#06B6D4] tabular-nums shrink-0">
                                {unread} new
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Active Conversation Stage */}
            <div
              className={`${
                selectedConversationId ? 'flex' : 'hidden lg:flex'
              } flex-1 flex-col min-w-0 h-full`}
            >
              {activeConversation && activeOtherUser ? (
                <ChatView
                  conversation={activeConversation}
                  currentProfile={profile}
                  otherUser={activeOtherUser}
                  isBlockedByMe={blockedByMeSet.has(activeOtherUser.uid)}
                  hasBlockedMe={blockedMeUids.has(activeOtherUser.uid)}
                  onBackMobile={() => setSelectedConversationId(null)}
                  onOpenOtherProfile={() => setInspectingUser(activeOtherUser)}
                  onReportMessage={(msg) =>
                    setReportingTarget({ user: activeOtherUser, message: msg })
                  }
                  onNotifyToast={showToast}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-3xl bg-[#11131C] border border-white/10 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-[#06B6D4]" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h2 className="font-display text-xl font-bold text-white">
                      Select a Conversation or Enter an ID
                    </h2>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      Your 10-digit Messaging ID is{' '}
                      <span className="font-mono text-[#06B6D4] font-semibold tabular-nums">
                        {formatMessagingIdDisplay(profile.messagingId)}
                      </span>
                      . Share it with anyone you want to message privately.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFindUserModal(true)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#06B6D4] text-[#090A0F] font-semibold text-xs hover:bg-[#22D3EE] transition-colors inline-flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    <span>Find User by 10-Digit ID</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* People / Contacts Directory Tab */}
        {activeTab === 'people' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
                    People &amp; 10-Digit Directory
                  </h1>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Search any user by their 10-digit Messaging ID or reconnect with people you have chatted with.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFindUserModal(true)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#06B6D4] text-[#090A0F] font-semibold text-xs hover:bg-[#22D3EE] transition-colors inline-flex items-center justify-center gap-2 shrink-0"
                >
                  <Search className="w-4 h-4" />
                  <span>Search 10-Digit ID</span>
                </button>
              </div>

              {knownPeople.length === 0 ? (
                <div className="rounded-3xl bg-[#11131C] border border-white/10 p-10 text-center space-y-4">
                  <Users className="w-8 h-8 text-[#06B6D4] mx-auto" />
                  <div className="space-y-1">
                    <div className="text-base font-semibold text-white">
                      No recent contacts yet
                    </div>
                    <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                      CipherID never asks for your phone&apos;s address book. People you message via their 10-digit ID will appear here automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFindUserModal(true)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#161926] border border-white/10 text-xs font-semibold text-white hover:border-[#06B6D4] transition-colors"
                  >
                    Enter a 10-Digit Messaging ID
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {knownPeople.map((person) => {
                    const isBlocked = blockedByMeSet.has(person.uid);
                    return (
                      <div
                        key={person.uid}
                        className="rounded-2xl bg-[#11131C] border border-white/10 p-4 flex items-center justify-between gap-3"
                      >
                        <button
                          type="button"
                          onClick={() => setInspectingUser(person)}
                          className="flex items-center gap-3.5 min-w-0 text-left flex-1"
                        >
                          <UserAvatar
                            avatarUrl={person.avatarUrl}
                            displayName={person.displayName}
                            size="lg"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">
                              {person.displayName}
                            </div>
                            <div className="text-xs text-[#94A3B8] truncate">
                              @{person.username}
                            </div>
                            <div className="text-xs font-mono text-[#06B6D4] mt-0.5 tabular-nums">
                              ID {formatMessagingIdDisplay(person.messagingId)}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          {isBlocked ? (
                            <span className="text-xs text-[#EF4444] font-medium">
                              Blocked
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleStartConversationWithUser({
                                  messagingId: person.messagingId,
                                  uid: person.uid,
                                  displayName: person.displayName,
                                  username: person.username,
                                  avatarUrl: person.avatarUrl,
                                  bio: person.bio,
                                  status: person.status,
                                  allowLookup: person.privacyAllowIdLookup,
                                  createdAt: person.createdAt,
                                  updatedAt: person.updatedAt,
                                })
                              }
                              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#06B6D4] text-[#090A0F] text-xs font-semibold hover:bg-[#22D3EE] transition-colors"
                            >
                              Message
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings & Profile Tab */}
        {activeTab === 'settings' && (
          <SettingsView
            profile={profile}
            privateConfig={privateConfig}
            blocksByMe={blocksByMe}
            myReports={myReports}
            isAdmin={isAdmin}
            onProfileUpdated={(upd) =>
              setProfile((prev) => (prev ? { ...prev, ...upd } : prev))
            }
            onPrivateConfigUpdated={(upd) =>
              setPrivateConfig((prev) => (prev ? { ...prev, ...upd } : prev))
            }
            onAdminGranted={() => {
              setIsAdmin(true);
              setActiveTab('admin');
              if (sbUser) {
                ensureUserProfile({
                  uid: sbUser.id,
                  email: sbUser.email || privateConfig.email,
                })
                  .then((ensured) => {
                    setProfile(ensured.profile);
                    setPrivateConfig(ensured.privateConfig);
                    setIsAdmin(true);
                  })
                  .catch(() => {});
              }
            }}
            onOpenAdmin={() => setActiveTab('admin')}
            onOpenLegal={(tab) => setLegalTab(tab)}
            onSignOut={handleSignOut}
            onNotifyToast={showToast}
          />
        )}

        {/* Admin Dashboard Tab */}
        {activeTab === 'admin' && (
          <AdminDashboard
            onBack={() => setActiveTab('settings')}
            onNotifyToast={showToast}
          />
        )}

        {/* Mobile Bottom Tab Bar */}
        {!(activeTab === 'chats' && selectedConversationId) && (
          <nav
            aria-label="Primary mobile navigation"
            className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#11131C]/95 backdrop-blur-md border-t border-white/[0.08] grid grid-cols-3 items-center"
          >
            <button
              type="button"
              onClick={() => setActiveTab('chats')}
              className={`h-full flex flex-col items-center justify-center ${
                activeTab === 'chats' ? 'text-[#06B6D4]' : 'text-[#94A3B8]'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-[11px] font-medium mt-1">
                Chats {totalUnreadMessages > 0 ? `(${totalUnreadMessages})` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('people')}
              className={`h-full flex flex-col items-center justify-center ${
                activeTab === 'people' ? 'text-[#06B6D4]' : 'text-[#94A3B8]'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[11px] font-medium mt-1">People</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`h-full flex flex-col items-center justify-center ${
                activeTab === 'settings' || activeTab === 'admin'
                  ? 'text-[#06B6D4]'
                  : 'text-[#94A3B8]'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[11px] font-medium mt-1">Profile</span>
            </button>
          </nav>
        )}
      </div>

      {/* Modals */}
      {showFindUserModal && (
        <FindUserModal
          currentProfile={profile}
          blockedUids={blockedByMeSet}
          onClose={() => setShowFindUserModal(false)}
          onStartConversation={handleStartConversationWithUser}
        />
      )}

      {inspectingUser && (
        <UserProfileModal
          user={inspectingUser}
          isBlocked={blockedByMeSet.has(inspectingUser.uid)}
          onClose={() => setInspectingUser(null)}
          onMessage={() =>
            handleStartConversationWithUser({
              messagingId: inspectingUser.messagingId,
              uid: inspectingUser.uid,
              displayName: inspectingUser.displayName,
              username: inspectingUser.username,
              avatarUrl: inspectingUser.avatarUrl,
              bio: inspectingUser.bio,
              status: inspectingUser.status,
              allowLookup: inspectingUser.privacyAllowIdLookup,
              createdAt: inspectingUser.createdAt,
              updatedAt: inspectingUser.updatedAt,
            })
          }
          onToggleBlock={() => handleToggleBlockUser(inspectingUser)}
          onReport={() => {
            const target = inspectingUser;
            setInspectingUser(null);
            setReportingTarget({ user: target });
          }}
        />
      )}

      {reportingTarget && (
        <ReportModal
          reporterId={profile.uid}
          reportedUserId={reportingTarget.user.uid}
          reportedMessagingId={reportingTarget.user.messagingId}
          reportedDisplayName={reportingTarget.user.displayName}
          messageId={reportingTarget.message?.id}
          messageSnippet={reportingTarget.message?.content}
          onClose={() => setReportingTarget(null)}
          onSubmitted={() => showToast('Report submitted for administrator review')}
        />
      )}

      <LegalModal tab={legalTab} onClose={() => setLegalTab(null)} />
    </div>
  );
}
