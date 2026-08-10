import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { getToken, type ChatMessage, type MessageAttachment } from "./api";
import { API_BASE } from "./config";
import { useAuth } from "./AuthContext";

export type TypingPayload = {
  conversationId: string;
  userId: string;
  typing: boolean;
};

export type PresencePayload = {
  userId: string;
  online: boolean;
};

export type MessagesSeenPayload = {
  conversationId: string;
  userId: string;
  readAt: string;
};

export type SocketHandlers = {
  onMessage?: (msg: ChatMessage) => void;
  onTranslated?: (payload: {
    id: string;
    conversationId: string;
    text: string;
    originalText: string;
    translating: boolean;
  }) => void;
  onTyping?: (payload: TypingPayload) => void;
  onPresence?: (payload: PresencePayload) => void;
  onMessagesSeen?: (payload: MessagesSeenPayload) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

type SocketContextValue = {
  connected: boolean;
  sendMessage: (
    conversationId: string,
    text: string,
    attachment?: MessageAttachment | null,
    replyToId?: string | null
  ) => void;
  sendTyping: (conversationId: string, typing: boolean) => void;
  checkPresence: (userId: string) => void;
  markRead: (conversationId: string) => void;
  subscribe: (handlers: SocketHandlers) => () => void;
};

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef(new Set<SocketHandlers>());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const token = getToken();
    if (!token) return;

    const socket = io(API_BASE || "/", {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      listenersRef.current.forEach((h) => h.onConnect?.());
    });
    socket.on("disconnect", () => {
      setConnected(false);
      listenersRef.current.forEach((h) => h.onDisconnect?.());
    });
    socket.on("message", (msg: ChatMessage) => {
      listenersRef.current.forEach((h) => h.onMessage?.(msg));
    });
    socket.on("message_translated", (payload) => {
      listenersRef.current.forEach((h) => h.onTranslated?.(payload));
    });
    socket.on("typing", (payload: TypingPayload) => {
      listenersRef.current.forEach((h) => h.onTyping?.(payload));
    });
    socket.on("presence", (payload: PresencePayload) => {
      listenersRef.current.forEach((h) => h.onPresence?.(payload));
    });
    socket.on("messages_seen", (payload: MessagesSeenPayload) => {
      listenersRef.current.forEach((h) => h.onMessagesSeen?.(payload));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user?.id]);

  const subscribe = useCallback((handlers: SocketHandlers) => {
    listenersRef.current.add(handlers);
    return () => {
      listenersRef.current.delete(handlers);
    };
  }, []);

  const sendMessage = useCallback(
    (
      conversationId: string,
      text: string,
      attachment?: MessageAttachment | null,
      replyToId?: string | null
    ) => {
      socketRef.current?.emit("send_message", {
        conversationId,
        text,
        attachment: attachment || null,
        replyToId: replyToId || null,
      });
    },
    []
  );

  const sendTyping = useCallback((conversationId: string, typing: boolean) => {
    socketRef.current?.emit("typing", { conversationId, typing });
  }, []);

  const checkPresence = useCallback((targetUserId: string) => {
    socketRef.current?.emit("presence_check", { userId: targetUserId });
  }, []);

  const markRead = useCallback((conversationId: string) => {
    socketRef.current?.emit("mark_read", { conversationId });
  }, []);

  const value = useMemo(
    () => ({
      connected,
      sendMessage,
      sendTyping,
      checkPresence,
      markRead,
      subscribe,
    }),
    [connected, sendMessage, sendTyping, checkPresence, markRead, subscribe]
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocketContext(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocketContext must be used within SocketProvider");
  }
  return ctx;
}
