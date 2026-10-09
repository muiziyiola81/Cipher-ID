import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  Copy,
  CornerUpLeft,
  Flag,
  Info,
  MoreVertical,
  Reply,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { Conversation, Message, UserProfile } from '../types/messaging';
import { formatMessagingIdDisplay } from '../utils/messagingId';
import {
  deleteOwnMessage,
  markConversationRead,
  sendMessage,
  subscribeToConversationMessages,
} from '../services/messagingService';
import { UserAvatar } from './UserAvatar';

interface ChatViewProps {
  conversation: Conversation;
  currentProfile: UserProfile;
  otherUser: UserProfile;
  isBlockedByMe: boolean;
  hasBlockedMe: boolean;
  onBackMobile: () => void;
  onOpenOtherProfile: () => void;
  onReportMessage: (msg: Message) => void;
  onNotifyToast: (text: string) => void;
}

function formatMessageTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const ChatView: React.FC<ChatViewProps> = ({
  conversation,
  currentProfile,
  otherUser,
  isBlockedByMe,
  hasBlockedMe,
  onBackMobile,
  onOpenOtherProfile,
  onReportMessage,
  onNotifyToast,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageLimit, setMessageLimit] = useState(50);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{
    id: string;
    text: string;
    senderName: string;
  } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeContextMenuMsgId, setActiveContextMenuMsgId] = useState<string | null>(null);
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToConversationMessages(
      conversation.id,
      messageLimit,
      (liveMessages) => {
        setMessages(liveMessages);
        setLoading(false);
      }
    );
    return () => {
      unsub();
    };
  }, [conversation.id, messageLimit]);

  // Mark incoming messages read when viewing conversation
  useEffect(() => {
    if (messages.length === 0 && conversation.unreadCountOne === 0 && conversation.unreadCountTwo === 0) {
      return;
    }
    markConversationRead(
      conversation,
      currentProfile.uid,
      messages,
      currentProfile.privacyShowReadReceipts
    );
  }, [
    conversation,
    currentProfile.uid,
    currentProfile.privacyShowReadReceipts,
    messages,
  ]);

  // Auto-scroll to newest message
  useEffect(() => {
    if (!showSearch) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, showSearch]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter((m) => !m.isDeleted && m.content.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || sending || isBlockedByMe || hasBlockedMe) return;

    setSending(true);
    const pendingText = trimmed;
    const pendingReply = replyTo;
    setInputText('');
    setReplyTo(null);

    try {
      await sendMessage({
        conversation,
        senderProfile: currentProfile,
        content: pendingText,
        replyTo: pendingReply,
      });
    } catch {
      setInputText(pendingText);
      setReplyTo(pendingReply);
      onNotifyToast('Message could not be sent. Verify connection or block status.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
    onNotifyToast('Message copied to clipboard');
    setActiveContextMenuMsgId(null);
  };

  const handleConfirmDelete = async (msgId: string) => {
    try {
      await deleteOwnMessage(conversation.id, msgId);
      onNotifyToast('Message deleted');
    } catch {
      onNotifyToast('Failed to delete message');
    } finally {
      setConfirmDeleteMsgId(null);
      setActiveContextMenuMsgId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#090A0F]">
      {/* Conversation Header */}
      <header className="h-16 px-4 border-b border-white/[0.07] bg-[#11131C]/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackMobile}
            aria-label="Back to conversations"
            className="lg:hidden min-h-[40px] min-w-[40px] -ml-1 flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onOpenOtherProfile}
            className="flex items-center gap-3 min-w-0 text-left group"
          >
            <UserAvatar
              avatarUrl={otherUser.avatarUrl}
              displayName={otherUser.displayName}
              size="md"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate group-hover:text-[#06B6D4] transition-colors">
                {otherUser.displayName}
              </div>
              <div className="text-xs font-mono text-[#94A3B8] truncate tabular-nums">
                ID {formatMessagingIdDisplay(otherUser.messagingId)}
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowSearch((prev) => !prev);
              setSearchQuery('');
            }}
            aria-label="Search messages in conversation"
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors ${
              showSearch
                ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenOtherProfile}
            aria-label="View contact profile and block options"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* In-Conversation Search Bar */}
      {showSearch && (
        <div className="px-4 py-2.5 bg-[#11131C] border-b border-white/[0.07] flex items-center gap-2">
          <Search className="w-4 h-4 text-[#64748B] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages in this chat..."
            className="flex-1 bg-transparent text-xs text-white placeholder-[#64748B] focus:outline-none"
          />
          {searchQuery && (
            <span className="text-[11px] font-mono text-[#94A3B8] tabular-nums">
              {filteredMessages.length} found
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            aria-label="Close message search"
            className="p-1 text-[#94A3B8] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Message Stream */}
      <div
        className="flex-1 overflow-y-auto px-4 py-5 space-y-3"
        onClick={() => setActiveContextMenuMsgId(null)}
      >
        {messages.length >= messageLimit && !searchQuery && (
          <div className="text-center pb-2">
            <button
              type="button"
              onClick={() => setMessageLimit((prev) => prev + 50)}
              className="px-4 py-1.5 rounded-xl bg-[#11131C] border border-white/10 text-xs text-[#94A3B8] hover:text-white transition-colors"
            >
              Load older messages
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 py-6">
            <div className="h-14 w-2/3 rounded-2xl bg-[#11131C] animate-pulse" />
            <div className="h-14 w-1/2 rounded-2xl bg-[#11131C] animate-pulse ml-auto" />
            <div className="h-14 w-3/5 rounded-2xl bg-[#11131C] animate-pulse" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4 space-y-3">
            <UserAvatar
              avatarUrl={otherUser.avatarUrl}
              displayName={otherUser.displayName}
              size="lg"
            />
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">
                {searchQuery ? 'No matching messages' : `Private Chat with ${otherUser.displayName}`}
              </h3>
              <p className="text-xs text-[#94A3B8] max-w-xs">
                {searchQuery
                  ? `No messages matched "${searchQuery}".`
                  : `Connected via 10-digit ID ${formatMessagingIdDisplay(
                      otherUser.messagingId
                    )}. Send a message below to begin.`}
              </p>
            </div>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMine = msg.senderId === currentProfile.uid;
            const isMenuOpen = activeContextMenuMsgId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div className="relative group max-w-[85%] sm:max-w-[72%]">
                  <div
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!msg.isDeleted) {
                        setActiveContextMenuMsgId(isMenuOpen ? null : msg.id);
                      }
                    }}
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition-colors ${
                      msg.isDeleted
                        ? 'bg-[#11131C] border border-white/[0.06] text-[#64748B] italic'
                        : isMine
                        ? 'bg-[#083344] border border-[#06B6D4]/30 text-[#F8FAFC]'
                        : 'bg-[#161926] border border-white/[0.07] text-[#F8FAFC]'
                    }`}
                  >
                    {/* Quoted Reply Preview */}
                    {!msg.isDeleted && msg.replyToId && (
                      <div className="mb-2 pl-2.5 border-l-2 border-[#06B6D4] text-xs text-[#94A3B8] bg-black/20 rounded-r-lg py-1 pr-2">
                        <div className="font-semibold text-[#06B6D4] truncate">
                          {msg.replyToSenderName || 'Reply'}
                        </div>
                        <div className="truncate">{msg.replyToText}</div>
                      </div>
                    )}

                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                    <div className="mt-1.5 flex items-center justify-end gap-2 text-[11px] font-mono tabular-nums text-[#94A3B8]">
                      <span>{formatMessageTime(msg.createdAt)}</span>
                      {isMine && !msg.isDeleted && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-0.5 text-[#22D3EE]">
                            {msg.status === 'read' ? (
                              <>
                                <CheckCheck className="w-3.5 h-3.5" />
                                <span>Read</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Sent</span>
                              </>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action Trigger Button */}
                  {!msg.isDeleted && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveContextMenuMsgId(isMenuOpen ? null : msg.id);
                      }}
                      aria-label="Message actions"
                      className={`absolute top-1.5 ${
                        isMine ? '-left-8' : '-right-8'
                      } w-7 h-7 rounded-lg bg-[#11131C] border border-white/10 text-[#94A3B8] hover:text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity`}
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Context Menu */}
                  {isMenuOpen && !msg.isDeleted && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`mt-1 z-20 w-44 rounded-xl bg-[#11131C] border border-white/15 shadow-xl py-1 text-xs ${
                        isMine ? 'ml-auto' : 'mr-auto'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTo({
                            id: msg.id,
                            text: msg.content.slice(0, 140),
                            senderName: isMine
                              ? currentProfile.displayName
                              : otherUser.displayName,
                          });
                          setActiveContextMenuMsgId(null);
                        }}
                        className="w-full px-3.5 py-2 text-left text-[#F8FAFC] hover:bg-white/5 flex items-center gap-2"
                      >
                        <Reply className="w-3.5 h-3.5 text-[#06B6D4]" />
                        <span>Reply</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.content)}
                        className="w-full px-3.5 py-2 text-left text-[#F8FAFC] hover:bg-white/5 flex items-center gap-2"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#06B6D4]" />
                        <span>Copy Text</span>
                      </button>

                      {isMine ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteMsgId(msg.id)}
                          className="w-full px-3.5 py-2 text-left text-[#EF4444] hover:bg-white/5 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Message</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveContextMenuMsgId(null);
                            onReportMessage(msg);
                          }}
                          className="w-full px-3.5 py-2 text-left text-[#F59E0B] hover:bg-white/5 flex items-center gap-2"
                        >
                          <Flag className="w-3.5 h-3.5" />
                          <span>Report Message</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Delete Confirmation Inline */}
                  {confirmDeleteMsgId === msg.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1.5 rounded-xl bg-[#11131C] border border-[#EF4444]/40 p-3 text-xs space-y-2"
                    >
                      <div className="text-white font-medium">Delete this message for everyone?</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteMsgId(null)}
                          className="px-3 py-1.5 rounded-lg bg-[#161926] text-[#94A3B8] hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmDelete(msg.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#EF4444] text-white font-semibold"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply Banner */}
      {replyTo && (
        <div className="px-4 py-2 bg-[#11131C] border-t border-white/[0.07] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 text-xs">
            <CornerUpLeft className="w-4 h-4 text-[#06B6D4] shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-[#06B6D4]">
                Replying to {replyTo.senderName}:{' '}
              </span>
              <span className="text-[#94A3B8] truncate">{replyTo.text}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            aria-label="Cancel reply"
            className="p-1 text-[#94A3B8] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Message Input or Blocked Notice */}
      {isBlockedByMe || hasBlockedMe ? (
        <div className="p-4 bg-[#11131C] border-t border-white/[0.07] text-center text-xs text-[#EF4444] flex items-center justify-center gap-2">
          <Ban className="w-4 h-4 shrink-0" />
          <span>
            {isBlockedByMe
              ? 'You have blocked this user. Unblock them in their profile to send messages.'
              : 'You cannot send messages to this conversation.'}
          </span>
        </div>
      ) : (
        <form
          onSubmit={handleSend}
          className="p-3 sm:p-4 bg-[#11131C] border-t border-white/[0.07] flex items-end gap-2.5 shrink-0"
        >
          <label htmlFor="chat-message-input" className="sr-only">
            Message {otherUser.displayName}
          </label>
          <textarea
            id="chat-message-input"
            rows={1}
            maxLength={2000}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${otherUser.displayName}...`}
            className="flex-1 min-h-[44px] max-h-32 px-4 py-2.5 rounded-2xl bg-[#161926] border border-white/10 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4] resize-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            aria-label="Send message"
            className="min-h-[44px] min-w-[44px] px-4 rounded-2xl bg-[#06B6D4] text-[#090A0F] font-semibold text-sm hover:bg-[#22D3EE] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      )}
    </div>
  );
};
