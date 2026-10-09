import React, { useState } from 'react';
import { AlertCircle, Check, Copy, MessageSquare, Search, ShieldAlert, UserCheck, X } from 'lucide-react';
import { MessagingIdIndex, UserProfile } from '../types/messaging';
import {
  formatMessagingIdDisplay,
  isValidMessagingIdFormat,
  sanitizeMessagingIdInput,
} from '../utils/messagingId';
import { findUserByMessagingId } from '../services/messagingService';
import { UserAvatar } from './UserAvatar';

interface FindUserModalProps {
  currentProfile: UserProfile;
  blockedUids: Set<string>;
  onClose: () => void;
  onStartConversation: (targetUser: MessagingIdIndex) => Promise<void>;
}

export const FindUserModal: React.FC<FindUserModalProps> = ({
  currentProfile,
  blockedUids,
  onClose,
  onStartConversation,
}) => {
  const [inputDigits, setInputDigits] = useState('');
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<MessagingIdIndex | null>(null);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [copiedOwn, setCopiedOwn] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  const handleDigitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = sanitizeMessagingIdInput(e.target.value);
    setInputDigits(cleaned);
    setErrorMsg(null);
    setSearchedOnce(false);
  };

  const handleCopyOwnId = () => {
    navigator.clipboard.writeText(currentProfile.messagingId).catch(() => {});
    setCopiedOwn(true);
    setTimeout(() => setCopiedOwn(false), 2000);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFoundUser(null);
    setSearchedOnce(false);

    if (!isValidMessagingIdFormat(inputDigits)) {
      setErrorMsg('Please enter an exact 10-digit numeric Messaging ID.');
      return;
    }

    if (inputDigits === currentProfile.messagingId) {
      setErrorMsg('That is your own 10-digit Messaging ID. Enter another user’s ID to connect.');
      return;
    }

    setSearching(true);
    try {
      const result = await findUserByMessagingId(inputDigits);
      setFoundUser(result);
      setSearchedOnce(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Lookup failed.');
    } finally {
      setSearching(false);
    }
  };

  const handleStart = async () => {
    if (!foundUser) return;
    setStartingChat(true);
    setErrorMsg(null);
    try {
      await onStartConversation(foundUser);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to start conversation. This user may have blocked communications.'
      );
    } finally {
      setStartingChat(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="find-user-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-[#11131C] border border-white/10 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-[#06B6D4] font-mono tabular-nums">10-DIGIT DIRECTORY</div>
            <h2 id="find-user-title" className="text-lg font-semibold text-white">
              New Chat · Find User by ID
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Find User dialog"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User's own ID quick share bar */}
        <div className="rounded-2xl bg-[#161926] border border-white/[0.07] p-3.5 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] text-[#94A3B8]">Your 10-Digit Messaging ID</div>
            <div className="font-mono text-sm font-semibold text-[#06B6D4] tabular-nums">
              {formatMessagingIdDisplay(currentProfile.messagingId)}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyOwnId}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#11131C] border border-white/10 text-xs font-medium text-[#F8FAFC] hover:border-[#06B6D4]/50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            {copiedOwn ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#06B6D4]" />
                <span>Copy My ID</span>
              </>
            )}
          </button>
        </div>

        <form onSubmit={handleSearch} className="space-y-3">
          <div>
            <label htmlFor="messaging-id-search" className="block text-xs font-medium text-[#94A3B8] mb-1.5">
              Enter Recipient&apos;s 10-Digit Messaging ID
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="messaging-id-search"
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={inputDigits}
                onChange={handleDigitChange}
                placeholder="e.g. 4829103847"
                className="w-full min-h-[48px] pl-10 pr-16 py-2.5 rounded-xl bg-[#161926] border border-white/10 font-mono text-base tracking-wider text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4] tabular-nums"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#64748B] tabular-nums">
                {inputDigits.length}/10
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">
              Messaging IDs are internal 10-digit identifiers, never telephone numbers.
            </p>
          </div>

          <button
            type="submit"
            disabled={searching || inputDigits.length !== 10}
            className="w-full min-h-[46px] rounded-xl bg-[#06B6D4] text-[#090A0F] font-semibold text-sm hover:bg-[#22D3EE] transition-colors disabled:opacity-40"
          >
            {searching ? 'Searching Directory...' : 'Find User'}
          </button>
        </form>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 p-3.5 text-xs text-[#F8FAFC] flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {searchedOnce && !foundUser && !errorMsg && (
          <div className="rounded-2xl bg-[#161926] border border-white/[0.07] p-5 text-center space-y-1.5">
            <div className="text-sm font-semibold text-white">User not found</div>
            <p className="text-xs text-[#94A3B8]">
              No active user matches Messaging ID <span className="font-mono text-white tabular-nums">{inputDigits}</span>, or the user has disabled ID lookup in their privacy settings.
            </p>
          </div>
        )}

        {foundUser && (
          <div className="rounded-2xl bg-[#161926] border border-[#06B6D4]/30 p-4 space-y-4">
            <div className="flex items-center gap-3.5">
              <UserAvatar
                avatarUrl={foundUser.avatarUrl}
                displayName={foundUser.displayName}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-white truncate">
                    {foundUser.displayName}
                  </h3>
                  <UserCheck className="w-4 h-4 text-[#06B6D4] shrink-0" />
                </div>
                <div className="text-xs text-[#94A3B8] truncate">@{foundUser.username}</div>
                <div className="text-xs font-mono text-[#06B6D4] mt-0.5 tabular-nums">
                  ID {formatMessagingIdDisplay(foundUser.messagingId)}
                </div>
              </div>
            </div>

            {foundUser.bio && (
              <p className="text-xs text-[#94A3B8] border-t border-white/[0.06] pt-2.5">
                {foundUser.bio}
              </p>
            )}

            {blockedUids.has(foundUser.uid) ? (
              <div className="rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 p-3 text-xs text-[#EF4444] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>You have blocked this user. Unblock them in Settings to start a chat.</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                disabled={startingChat}
                className="w-full min-h-[44px] rounded-xl bg-[#06B6D4] text-[#090A0F] font-semibold text-sm hover:bg-[#22D3EE] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{startingChat ? 'Opening Conversation...' : 'Start Conversation'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
