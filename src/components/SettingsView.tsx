import React, { useRef, useState } from 'react';
import {
  Ban,
  Bell,
  Check,
  Copy,
  FileText,
  Flag,
  Info,
  Lock,
  LogOut,
  Shield,
  Sliders,
  Upload,
  User,
} from 'lucide-react';
import {
  BlockRecord,
  ReportRecord,
  UserPrivateConfig,
  UserProfile,
} from '../types/messaging';
import {
  AVATAR_PRESETS,
  formatMessagingIdDisplay,
} from '../utils/messagingId';
import {
  bootstrapOwnerAdmin,
  unblockUser,
  updateNotificationSettings,
  updatePublicProfile,
  uploadProfileAvatar,
} from '../services/messagingService';
import { UserAvatar } from './UserAvatar';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsViewProps {
  profile: UserProfile;
  privateConfig: UserPrivateConfig;
  blocksByMe: BlockRecord[];
  myReports: ReportRecord[];
  isAdmin: boolean;
  onProfileUpdated: (updated: Partial<UserProfile>) => void;
  onPrivateConfigUpdated: (updated: Partial<UserPrivateConfig>) => void;
  onAdminGranted: () => void;
  onOpenAdmin: () => void;
  onOpenLegal: (tab: 'terms' | 'privacy' | 'about') => void;
  onSignOut: () => Promise<void>;
  onNotifyToast: (msg: string) => void;
}

type SettingsSubTab =
  | 'profile'
  | 'account'
  | 'privacy'
  | 'notifications'
  | 'blocked'
  | 'reports'
  | 'security';

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  privateConfig,
  blocksByMe,
  myReports,
  isAdmin,
  onProfileUpdated,
  onPrivateConfigUpdated,
  onAdminGranted,
  onOpenAdmin,
  onOpenLegal,
  onSignOut,
  onNotifyToast,
}) => {
  const [subTab, setSubTab] = useState<SettingsSubTab>('profile');
  const [bootstrapSecretInput, setBootstrapSecretInput] = useState('');
  const [bootstrappingAdmin, setBootstrappingAdmin] = useState(false);
  const [bootstrapFeedback, setBootstrapFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [customAvatarUrl, setCustomAvatarUrl] = useState(
    profile.avatarUrl.startsWith('http') ? profile.avatarUrl : ''
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [privacyAllowIdLookup, setPrivacyAllowIdLookup] = useState(
    profile.privacyAllowIdLookup
  );
  const [privacyShowReadReceipts, setPrivacyShowReadReceipts] = useState(
    profile.privacyShowReadReceipts
  );

  const [notifInApp, setNotifInApp] = useState(privateConfig.notifInApp);
  const [notifSound, setNotifSound] = useState(privateConfig.notifSound);
  const [notifPreview, setNotifPreview] = useState(privateConfig.notifPreview);

  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(profile.messagingId).catch(() => {});
    setCopiedId(true);
    onNotifyToast('10-Digit Messaging ID copied');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      onNotifyToast('Image file must be under 4 MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const publicUrl = await uploadProfileAvatar(profile.uid, file);
      setCustomAvatarUrl(publicUrl);
      setAvatarUrl(publicUrl);
      onNotifyToast('Profile picture uploaded to Supabase Storage');
    } catch (err: unknown) {
      onNotifyToast(
        err instanceof Error ? err.message : 'Failed to upload image to Supabase Storage'
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfileAndPrivacy = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    const chosenAvatar = customAvatarUrl.trim() || avatarUrl;
    try {
      await updatePublicProfile(profile, {
        displayName,
        username,
        avatarUrl: chosenAvatar,
        bio,
        privacyAllowIdLookup,
        privacyShowReadReceipts,
      });
      onProfileUpdated({
        displayName: displayName.trim() || profile.displayName,
        username: username.trim().toLowerCase() || profile.username,
        avatarUrl: chosenAvatar,
        bio: bio.trim(),
        privacyAllowIdLookup,
        privacyShowReadReceipts,
      });
      onNotifyToast('Profile and privacy settings saved');
    } catch {
      onNotifyToast('Could not save profile changes');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      await updateNotificationSettings(profile.uid, {
        notifInApp,
        notifSound,
        notifPreview,
      });
      onPrivateConfigUpdated({
        notifInApp,
        notifSound,
        notifPreview,
      });
      onNotifyToast('Notification preferences updated');
    } catch {
      onNotifyToast('Failed to update notification settings');
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (blockedUid: string, name: string) => {
    try {
      await unblockUser(profile.uid, blockedUid);
      onNotifyToast(`Unblocked ${name}`);
    } catch {
      onNotifyToast('Failed to unblock user');
    }
  };

  const handleClaimOwnerAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBootstrapFeedback(null);
    setBootstrappingAdmin(true);
    try {
      const res = await bootstrapOwnerAdmin(bootstrapSecretInput);
      // Clear secret from memory immediately
      setBootstrapSecretInput('');
      setBootstrapFeedback({
        type: 'success',
        message: res.message,
      });
      onAdminGranted();
      onNotifyToast(res.message);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Owner-admin bootstrap verification failed.';
      setBootstrapFeedback({
        type: 'error',
        message: msg,
      });
    } finally {
      setBootstrappingAdmin(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#090A0F] p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6 pb-20 lg:pb-8">
        {/* Top Profile Identity Banner */}
        <div className="rounded-3xl bg-[#11131C] border border-white/10 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <UserAvatar
              avatarUrl={customAvatarUrl.trim() || avatarUrl}
              displayName={displayName || profile.displayName}
              size="xl"
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">
                {profile.displayName}
              </h1>
              <div className="text-xs text-[#94A3B8] truncate">@{profile.username}</div>
              <div className="mt-1.5 flex items-center gap-2 text-xs font-mono text-[#06B6D4] tabular-nums">
                <span>ID {formatMessagingIdDisplay(profile.messagingId)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyId}
              className="flex-1 sm:flex-initial min-h-[42px] px-4 py-2 rounded-xl bg-[#161926] border border-white/10 text-xs font-semibold text-white hover:border-[#06B6D4]/50 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {copiedId ? (
                <>
                  <Check className="w-4 h-4 text-[#10B981]" />
                  <span>ID Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#06B6D4]" />
                  <span>Copy 10-Digit ID</span>
                </>
              )}
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="flex-1 sm:flex-initial min-h-[42px] px-4 py-2 rounded-xl bg-[#06B6D4] text-[#090A0F] text-xs font-semibold hover:bg-[#22D3EE] transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Shield className="w-4 h-4" />
                <span>Admin Console</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(
            [
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'account', label: 'Account', icon: Sliders },
              { id: 'privacy', label: 'Privacy', icon: Lock },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'blocked', label: `Blocked (${blocksByMe.length})`, icon: Ban },
              { id: 'reports', label: `Reports (${myReports.length})`, icon: Flag },
              { id: 'security', label: 'Security & Legal', icon: Shield },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = subTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSubTab(item.id)}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-[#06B6D4] text-[#090A0F] font-semibold'
                    : 'bg-[#11131C] border border-white/[0.07] text-[#94A3B8] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Edit Profile */}
        {subTab === 'profile' && (
          <form
            onSubmit={handleSaveProfileAndPrivacy}
            className="rounded-3xl bg-[#11131C] border border-white/10 p-6 space-y-5"
          >
            <div>
              <h2 className="text-base font-semibold text-white">Edit Public Profile</h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                These details are visible when another user looks up your 10-digit Messaging ID.
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-medium text-[#94A3B8]">
                Profile Picture (Supabase Storage or Preset)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setAvatarUrl(preset);
                      setCustomAvatarUrl('');
                    }}
                    aria-label={`Choose ${preset} avatar`}
                    className={`p-1 rounded-2xl border-2 transition-all ${
                      avatarUrl === preset && !customAvatarUrl
                        ? 'border-[#06B6D4] scale-105'
                        : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                  >
                    <UserAvatar
                      avatarUrl={preset}
                      displayName={displayName || profile.displayName}
                      size="md"
                    />
                  </button>
                ))}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleAvatarFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#161926] border border-white/10 text-xs font-medium text-white hover:border-[#06B6D4]/50 transition-colors flex items-center gap-2"
                >
                  <Upload className="w-3.5 h-3.5 text-[#06B6D4]" />
                  <span>{uploadingAvatar ? 'Uploading...' : 'Upload Photo'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-display-name" className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                  Display Name
                </label>
                <input
                  id="profile-display-name"
                  type="text"
                  required
                  maxLength={60}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#161926] border border-white/10 text-sm text-white focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div>
                <label htmlFor="profile-username" className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                  Username Handle
                </label>
                <input
                  id="profile-username"
                  type="text"
                  required
                  maxLength={30}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#161926] border border-white/10 text-sm text-white focus:outline-none focus:border-[#06B6D4]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="profile-custom-avatar" className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Or Paste Avatar Image URL (optional)
              </label>
              <input
                id="profile-custom-avatar"
                type="url"
                maxLength={500}
                value={customAvatarUrl}
                onChange={(e) => setCustomAvatarUrl(e.target.value)}
                placeholder="https://your-project.supabase.co/storage/v1/object/public/avatars/..."
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#161926] border border-white/10 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
              />
            </div>

            <div>
              <label htmlFor="profile-bio" className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Status / Bio ({bio.length}/160)
              </label>
              <textarea
                id="profile-bio"
                rows={2}
                maxLength={160}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#161926] border border-white/10 text-sm text-white focus:outline-none focus:border-[#06B6D4] resize-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#06B6D4] text-[#090A0F] font-semibold text-sm hover:bg-[#22D3EE] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving Changes...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Account */}
        {subTab === 'account' && (
          <div className="rounded-3xl bg-[#11131C] border border-white/10 p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white">Account &amp; Identifier</h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Your 10-digit Messaging ID is permanently bound to your Supabase account and cannot be reassigned.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-[#161926] border border-white/[0.07] p-4 space-y-1">
                <div className="text-xs text-[#94A3B8]">Assigned 10-Digit Messaging ID</div>
                <div className="font-mono text-lg font-semibold text-[#06B6D4] tabular-nums">
                  {formatMessagingIdDisplay(profile.messagingId)}
                </div>
                <div className="text-[11px] text-[#64748B]">
                  Internal identifier · Never a telephone number
                </div>
              </div>

              <div className="rounded-2xl bg-[#161926] border border-white/[0.07] p-4 space-y-1">
                <div className="text-xs text-[#94A3B8]">Private Account Email (Hidden from all users)</div>
                <div className="text-sm font-semibold text-white truncate">
                  {privateConfig.email}
                </div>
                <div className="text-[11px] text-[#64748B]">
                  Protected by Supabase Auth · Standing: {profile.status}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <PWAInstallButton variant="full" />
            </div>

            <div className="pt-4 border-t border-white/[0.07] flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Sign Out of CipherID</div>
                <div className="text-xs text-[#94A3B8]">
                  You can sign back in anytime to access your 10-digit ID.
                </div>
              </div>
              {confirmLogout ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmLogout(false)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#161926] text-xs text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#EF4444] text-xs font-semibold text-white"
                  >
                    Confirm Logout
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmLogout(true)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-xs font-semibold text-[#EF4444] hover:bg-[#EF4444]/25 transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Privacy */}
        {subTab === 'privacy' && (
          <div className="rounded-3xl bg-[#11131C] border border-white/10 p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white">Privacy Controls</h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Control how your 10-digit Messaging ID can be discovered and whether read receipts are shared.
              </p>
            </div>

            <div className="space-y-3">
              <label className="rounded-2xl bg-[#161926] border border-white/[0.07] p-4 flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-white">
                    Allow Discovery by 10-Digit Messaging ID
                  </div>
                  <div className="text-xs text-[#94A3B8]">
                    When enabled, users who know your exact 10-digit ID can find your public profile.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={privacyAllowIdLookup}
                  onChange={(e) => setPrivacyAllowIdLookup(e.target.checked)}
                  className="w-5 h-5 accent-[#06B6D4] rounded"
                />
              </label>

              <label className="rounded-2xl bg-[#161926] border border-white/[0.07] p-4 flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-white">
                    Send Read Receipts
                  </div>
                  <div className="text-xs text-[#94A3B8]">
                    Let participants see when you have read their messages in one-to-one chats.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={privacyShowReadReceipts}
                  onChange={(e) => setPrivacyShowReadReceipts(e.target.checked)}
                  className="w-5 h-5 accent-[#06B6D4] rounded"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveProfileAndPrivacy()}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#06B6D4] text-[#090A0F] font-semibold text-sm hover:bg-[#22D3EE] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Privacy Settings'}
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Notifications */}
        {subTab === 'notifications' && (
          <div className="rounded-3xl bg-[#11131C] border border-white/10 p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white">Notification Preferences</h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Configure real-time in-app message banners and alert behavior. No intrusive device permissions required.
              </p>
            </div>

            <div className="space-y-3">
              <label className="rounded-2xl bg-[#161926] border border-white/[0.07] p-4 flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-white">In-App Unread Banners</div>
                  <div className="text-xs text-[#94A3B8]">
                    Show real-time unread badges and notification alerts inside CipherID.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifInApp}
                  onChange={(e) => setNotifInApp(e.target.checked)}
                  className="w-5 h-5 accent-[#06B6D4] rounded"
                />
              </label>

              <label className="rounded-2xl bg-[#161926] border border-white/[0.07] p-4 flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-white">Message Preview Snippet</div>
                  <div className="text-xs text-[#94A3B8]">
                    Include message text previews in your in-app notification feed.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifPreview}
                  onChange={(e) => setNotifPreview(e.target.checked)}
                  className="w-5 h-5 accent-[#06B6D4] rounded"
                />
              </label>

              <label className="rounded-2xl bg-[#161926] border border-white/[0.07] p-4 flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-white">Subtle Audio Chime</div>
                  <div className="text-xs text-[#94A3B8]">
                    Play a soft notification indicator when a new message arrives.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifSound}
                  onChange={(e) => setNotifSound(e.target.checked)}
                  className="w-5 h-5 accent-[#06B6D4] rounded"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveNotifications}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#06B6D4] text-[#090A0F] font-semibold text-sm hover:bg-[#22D3EE] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Notification Settings'}
              </button>
            </div>
          </div>
        )}

        {/* Tab 5: Blocked Users */}
        {subTab === 'blocked' && (
          <div className="rounded-3xl bg-[#11131C] border border-white/10 p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Blocked Users</h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Blocked users cannot start conversations or send messages to your 10-digit ID.
              </p>
            </div>

            {blocksByMe.length === 0 ? (
              <div className="rounded-2xl bg-[#161926] border border-white/[0.07] p-8 text-center space-y-1">
                <div className="text-sm font-medium text-white">No blocked users</div>
                <p className="text-xs text-[#94A3B8]">
                  You have not blocked any 10-digit Messaging IDs.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {blocksByMe.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-2xl bg-[#161926] border border-white/[0.07] p-4 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {b.blockedDisplayName}
                      </div>
                      <div className="text-xs font-mono text-[#06B6D4] tabular-nums">
                        ID {formatMessagingIdDisplay(b.blockedMessagingId)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblock(b.blockedId, b.blockedDisplayName)}
                      className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#11131C] border border-white/10 text-xs font-semibold text-white hover:border-[#06B6D4] transition-colors"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Submitted Reports */}
        {subTab === 'reports' && (
          <div className="rounded-3xl bg-[#11131C] border border-white/10 p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Your Moderation Reports</h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Track reports you have submitted for administrator review.
              </p>
            </div>

            {myReports.length === 0 ? (
              <div className="rounded-2xl bg-[#161926] border border-white/[0.07] p-8 text-center space-y-1">
                <div className="text-sm font-medium text-white">No reports submitted</div>
                <p className="text-xs text-[#94A3B8]">
                  You can report any user or message from their profile or message menu.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-2xl bg-[#161926] border border-white/[0.07] p-4 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">
                        Category: {rep.reason} · ID {formatMessagingIdDisplay(rep.reportedMessagingId)}
                      </span>
                      <span className="font-mono text-[#06B6D4] tabular-nums">
                        Status: {rep.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#94A3B8]">{rep.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 7: Security & Legal */}
        {subTab === 'security' && (
          <div className="rounded-3xl bg-[#11131C] border border-white/10 p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white">Security, About &amp; Legal</h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Supabase PostgreSQL Row Level Security (RLS) policies and application documentation.
              </p>
            </div>

            <div className="rounded-2xl bg-[#161926] border border-white/[0.07] p-4 space-y-2 text-xs text-[#94A3B8] leading-relaxed">
              <div className="text-sm font-semibold text-white">Supabase Row Level Security (RLS) Active</div>
              <p>
                • Public profiles never expose your authentication email address.<br />
                • Only verified conversation participants can read or insert messages in a thread.<br />
                • Blocked users are rejected by PostgreSQL RLS policies.<br />
                • 10-digit Messaging IDs and administrator flags are protected by PostgreSQL triggers.
              </p>
            </div>

            {/* Server-Side Owner-Admin Bootstrap Card */}
            <div className="rounded-2xl bg-[#161926] border border-white/10 p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Shield className="w-4 h-4 text-[#06B6D4]" />
                    <span>Owner-Admin Server Bootstrap</span>
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    Ordinary users cannot modify <span className="font-mono text-white">is_admin</span>. To promote the designated owner account (<span className="font-mono text-white">{privateConfig.email}</span>), enter the server-side bootstrap secret verified by Supabase.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold shrink-0 ${
                    isAdmin
                      ? 'bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981]'
                      : 'bg-white/5 border border-white/10 text-[#94A3B8]'
                  }`}
                >
                  {isAdmin ? 'ADMIN ACTIVE' : 'STANDARD USER'}
                </span>
              </div>

              <form onSubmit={handleClaimOwnerAdmin} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="password"
                    autoComplete="off"
                    value={bootstrapSecretInput}
                    onChange={(e) => setBootstrapSecretInput(e.target.value)}
                    placeholder="Enter server-side OWNER_BOOTSTRAP_SECRET..."
                    className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-[#11131C] border border-white/10 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                  />
                  <button
                    type="submit"
                    disabled={bootstrappingAdmin || !bootstrapSecretInput.trim()}
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-[#06B6D4] text-[#090A0F] text-xs font-semibold hover:bg-[#22D3EE] transition-colors disabled:opacity-50 shrink-0"
                  >
                    {bootstrappingAdmin
                      ? 'Verifying on Server...'
                      : isAdmin
                      ? 'Re-Verify Owner Bootstrap'
                      : 'Verify & Grant Owner Admin'}
                  </button>
                </div>

                {bootstrapFeedback && (
                  <div
                    className={`rounded-xl p-3 text-xs border ${
                      bootstrapFeedback.type === 'success'
                        ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                        : 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
                    }`}
                  >
                    {bootstrapFeedback.message}
                  </div>
                )}
              </form>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => onOpenLegal('about')}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#161926] border border-white/10 text-xs font-medium text-white hover:border-[#06B6D4]/50 transition-colors flex items-center justify-center gap-2"
              >
                <Info className="w-4 h-4 text-[#06B6D4]" />
                <span>About CipherID</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenLegal('terms')}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#161926] border border-white/10 text-xs font-medium text-white hover:border-[#06B6D4]/50 transition-colors flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4 text-[#06B6D4]" />
                <span>Terms of Service</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenLegal('privacy')}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#161926] border border-white/10 text-xs font-medium text-white hover:border-[#06B6D4]/50 transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4 text-[#06B6D4]" />
                <span>Privacy Policy</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
