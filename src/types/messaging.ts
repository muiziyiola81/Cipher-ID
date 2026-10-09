export type AccountStatus = 'active' | 'restricted' | 'suspended';

export interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  messagingId: string;
  avatarUrl: string;
  bio: string;
  status: AccountStatus;
  privacyAllowIdLookup: boolean;
  privacyShowReadReceipts: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPrivateConfig {
  uid: string;
  email: string;
  notifInApp: boolean;
  notifSound: boolean;
  notifPreview: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessagingIdIndex {
  messagingId: string;
  uid: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  bio: string;
  status: AccountStatus;
  allowLookup: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  participantOneId: string;
  participantTwoId: string;
  participants: [string, string];
  lastMessageText: string;
  lastMessageSenderId: string;
  lastMessageAt: string;
  unreadCountOne: number;
  unreadCountTwo: number;
  createdAt: string;
  updatedAt: string;
}

export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  replyToId: string;
  replyToText: string;
  replyToSenderName: string;
  status: MessageStatus;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlockRecord {
  id: string;
  blockerId: string;
  blockedId: string;
  blockedMessagingId: string;
  blockedDisplayName: string;
  createdAt: string;
}

export type ReportReason = 'Spam' | 'Harassment' | 'Scam' | 'Impersonation' | 'Other';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface ReportRecord {
  id: string;
  reporterId: string;
  reporterMessagingId: string;
  reporterDisplayName: string;
  reporterUsername: string;
  reporterAvatarUrl: string;
  reportedUserId: string;
  reportedMessagingId: string;
  reportedDisplayName: string;
  reportedUsername: string;
  reportedAvatarUrl: string;
  reportedAccountStatus: AccountStatus;
  messageId: string;
  messageContent: string;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  senderId: string;
  type: 'message' | 'system';
  title: string;
  body: string;
  referenceId: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}
