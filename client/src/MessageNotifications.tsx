import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, type ChatMessage } from "./api";
import { useAuth } from "./AuthContext";
import {
  enablePushNotifications,
  isPushSubscribed,
  listenForSwNavigation,
  notificationPermission,
  showMessageNotification,
} from "./pwa";
import { useSocketContext } from "./SocketProvider";

export function MessageNotifications() {
  const { user, t } = useAuth();
  const { subscribe } = useSocketContext();
  const location = useLocation();
  const navigate = useNavigate();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    return listenForSwNavigation((url) => navigate(url));
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    if (notificationPermission() === "granted") {
      enablePushNotifications().catch(console.error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    async function notify(
      conversationId: string,
      messageId: string,
      body: string
    ) {
      const onThisChat = pathRef.current === `/chat/${conversationId}`;
      if (onThisChat && document.hasFocus()) return;

      // Web push already covers background / phone; avoid duplicate banners
      if (await isPushSubscribed()) return;

      let senderName = t.you;
      try {
        const { conversations } = await api.conversations();
        const conv = conversations.find((c) => c.id === conversationId);
        senderName = conv?.otherUser?.displayName || t.you;
      } catch {
        /* use fallback title */
      }

      await showMessageNotification(
        senderName,
        body,
        conversationId,
        messageId
      );
    }

    return subscribe({
      onMessage: async (msg: ChatMessage) => {
        if (msg.senderId === user.id) return;
        // Wait for the converted text when translation is in progress
        if (msg.translating) return;
        await notify(msg.conversationId, msg.id, msg.text);
      },
      onTranslated: async (payload) => {
        await notify(payload.conversationId, payload.id, payload.text);
      },
    });
  }, [subscribe, user?.id, t.you]);

  return null;
}
