export type Lang = "en" | "zh";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  language: Lang;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participantIds: [string, string];
  updatedAt: string;
  lastReadAtA: string | null;
  lastReadAtB: string | null;
}

export interface MessageAttachment {
  url: string;
  name: string;
  mime: string;
  size: number;
}

export interface MessageReplyPreview {
  id: string;
  senderId: string;
  text: string;
  attachmentMime?: string | null;
  attachmentName?: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  originalText: string;
  translations: Partial<Record<Lang, string>>;
  createdAt: string;
  attachment?: MessageAttachment | null;
  replyToId?: string | null;
}

export type PublicUser = Omit<User, "passwordHash">;
