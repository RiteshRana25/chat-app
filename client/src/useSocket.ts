import { useEffect, useRef } from "react";
import type { ChatMessage } from "./api";
import { useSocketContext, type SocketHandlers } from "./SocketProvider";

export function useSocket(handlers: SocketHandlers) {
  const {
    subscribe,
    sendMessage,
    sendTyping,
    checkPresence,
    markRead,
    connected,
  } = useSocketContext();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    return subscribe({
      onConnect: () => handlersRef.current.onConnect?.(),
      onDisconnect: () => handlersRef.current.onDisconnect?.(),
      onMessage: (msg: ChatMessage) => handlersRef.current.onMessage?.(msg),
      onTranslated: (payload) => handlersRef.current.onTranslated?.(payload),
      onTyping: (payload) => handlersRef.current.onTyping?.(payload),
      onPresence: (payload) => handlersRef.current.onPresence?.(payload),
      onMessagesSeen: (payload) => handlersRef.current.onMessagesSeen?.(payload),
    });
  }, [subscribe]);

  return {
    sendMessage,
    sendTyping,
    checkPresence,
    markRead,
    connected,
  };
}
