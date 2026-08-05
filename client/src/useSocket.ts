import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "./api";
import { useSocketContext, type SocketHandlers } from "./SocketProvider";

export function useSocket(handlers: SocketHandlers) {
  const { subscribe, sendMessage, connected } = useSocketContext();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [localConnected, setLocalConnected] = useState(connected);

  useEffect(() => {
    setLocalConnected(connected);
  }, [connected]);

  useEffect(() => {
    return subscribe({
      onConnect: () => {
        setLocalConnected(true);
        handlersRef.current.onConnect?.();
      },
      onDisconnect: () => {
        setLocalConnected(false);
        handlersRef.current.onDisconnect?.();
      },
      onMessage: (msg: ChatMessage) => handlersRef.current.onMessage?.(msg),
      onTranslated: (payload) => handlersRef.current.onTranslated?.(payload),
    });
  }, [subscribe]);

  return {
    sendMessage,
    connected: () => localConnected,
  };
}
