import React, { useState } from 'react';
import { Ban, Check, Copy, Flag, MessageSquare, ShieldAlert, X } from 'lucide-react';
import { UserProfile } from '../types/messaging';
import { formatMessagingIdDisplay } from '../utils/messagingId';
import { UserAvatar } from './UserAvatar';

interface UserProfileModalProps {
  user: UserProfile;
  isBlocked: boolean;
  onClose: () => void;
  onMessage: () => void;
  onToggleBlock: () => Promise<void>;
  onReport: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isBlocked,
  onClose,
  onMessage,
  onToggleBlock,
  onReport,
}) => {
  const [copied, setCopied] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.messagingId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBlockAction = async () => {
    setBusy(true);
    try {
      await onToggleBlock();
      setConfirmBlock(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-profile-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-[#11131C] border border-white/10 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-[#06B6D4] tabular-nums">CONTACT PROFILE</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close contact profile"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center space-y-3">
          <UserAvatar avatarUrl={user.avatarUrl} displayName={user.displayName} size="xl" />
          <div>
            <h2 id="contact-profile-title" className="text-xl font-bold text-white">
              {user.displayName}
            </h2>
            <p className="text-xs text-[#94A3B8]">@{user.username}</p>
          </div>
          {user.bio && (
            <p className="text-sm text-[#F8FAFC] max-w-xs leading-relaxed">{user.bio}</p>
          )}
        </div>

        <div className="rounded-2xl bg-[#161926] border border-white/[0.07] p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-[#94A3B8]">10-Digit Messaging ID</div>
            <div className="font-mono text-base font-semibold text-[#06B6D4] mt-0.5 tabular-nums">
              {formatMessagingIdDisplay(user.messagingId)}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyId}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#11131C] border border-white/10 text-xs font-medium text-[#F8FAFC] hover:border-[#06B6D4]/50 transition-colors flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#06B6D4]" />
                <span>Copy ID</span>
              </>
            )}
          </button>
        </div>

        {isBlocked && (
          <div className="rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 p-3 text-xs text-[#EF4444] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>You have blocked this user. They cannot send you messages.</span>
          </div>
        )}

        {confirmBlock ? (
          <div className="rounded-2xl bg-[#161926] border border-[#EF4444]/40 p-4 space-y-3">
            <div className="text-xs font-semibold text-white">
              {isBlocked ? `Unblock ${user.displayName}?` : `Block ${user.displayName}?`}
            </div>
            <p className="text-xs text-[#94A3B8]">
              {isBlocked
                ? 'They will be able to start conversations and message your 10-digit ID again.'
                : 'Blocked users cannot start new conversations or send messages to you.'}
            </p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmBlock(false)}
                className="flex-1 min-h-[40px] rounded-xl bg-[#11131C] border border-white/10 text-xs font-medium text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleBlockAction}
                className="flex-1 min-h-[40px] rounded-xl bg-[#EF4444] text-white text-xs font-semibold hover:bg-[#DC2626] transition-colors"
              >
                {busy ? 'Updating...' : isBlocked ? 'Confirm Unblock' : 'Confirm Block'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => {
                onMessage();
                onClose();
              }}
              disabled={isBlocked}
              className="min-h-[44px] rounded-xl bg-[#06B6D4] text-[#090A0F] font-semibold text-xs hover:bg-[#22D3EE] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Message</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmBlock(true)}
              className="min-h-[44px] rounded-xl bg-[#161926] border border-white/10 text-[#F8FAFC] font-medium text-xs hover:border-[#EF4444]/50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Ban className="w-4 h-4 text-[#EF4444]" />
              <span>{isBlocked ? 'Unblock' : 'Block'}</span>
            </button>

            <button
              type="button"
              onClick={onReport}
              className="min-h-[44px] rounded-xl bg-[#161926] border border-white/10 text-[#F8FAFC] font-medium text-xs hover:border-[#F59E0B]/50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Flag className="w-4 h-4 text-[#F59E0B]" />
              <span>Report</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
