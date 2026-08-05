import type { Lang } from "./i18n";
import { apiUrl } from "./config";

export interface User {
  id: string;
  email: string;
  displayName: string;
  language: Lang;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  updatedAt: string;
  otherUser: User | null;
  lastMessage: {
    id: string;
    text: string;
    senderId: string;
    createdAt: string;
  } | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  originalText: string;
  createdAt: string;
  translating?: boolean;
}

const TOKEN_KEY = "bridgechat_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(apiUrl(path), { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: string }).error;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  register: (body: {
    email: string;
    password: string;
    displayName: string;
    language: Lang;
  }) =>
    request<{ token: string; user: User }>("/api/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: User }>("/api/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: () => request<{ user: User }>("/api/me"),
  setLanguage: (language: Lang) =>
    request<{ user: User }>("/api/me/language", {
      method: "PATCH",
      body: JSON.stringify({ language }),
    }),
  searchUser: (email: string) =>
    request<{ user: User }>(`/api/users/search?email=${encodeURIComponent(email)}`),
  conversations: () =>
    request<{ conversations: ConversationSummary[] }>("/api/conversations"),
  startConversation: (email: string) =>
    request<{ conversation: { id: string; otherUser: User; updatedAt: string } }>(
      "/api/conversations",
      { method: "POST", body: JSON.stringify({ email }) }
    ),
  messages: (id: string) =>
    request<{ messages: ChatMessage[] }>(`/api/conversations/${id}/messages`),
  getPushPublicKey: () => request<{ publicKey: string }>("/api/push/public-key"),
  subscribePush: (subscription: PushSubscriptionJSON) =>
    request<{ ok: boolean }>("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription }),
    }),
  unsubscribePush: (endpoint: string) =>
    request<{ ok: boolean }>("/api/push/subscribe", {
      method: "DELETE",
      body: JSON.stringify({ endpoint }),
    }),
};
