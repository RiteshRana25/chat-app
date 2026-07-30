import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { getToken } from "./api";
import type { ChatMessage } from "./api";
import { API_BASE } from "./config";

export function useSocket(handlers: {
  onMessage?: (msg: ChatMessage) => void;
  onTranslated?: (payload: {
    id: string;
    conversationId: string;
    text: string;
    originalText: string;
    translating: boolean;
  }) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const socket = io(API_BASE || "/", {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => handlersRef.current.onConnect?.());
    socket.on("disconnect", () => handlersRef.current.onDisconnect?.());
    socket.on("message", (msg: ChatMessage) =>
      handlersRef.current.onMessage?.(msg)
    );
    socket.on("message_translated", (payload) =>
      handlersRef.current.onTranslated?.(payload)
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return {
    sendMessage: (conversationId: string, text: string) => {
      socketRef.current?.emit("send_message", { conversationId, text });
    },
    connected: () => !!socketRef.current?.connected,
  };
}
