/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { createHandlerBoundToURL } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;

const NOTIF_ICON = "/yin-yang.png";
const NOTIF_BADGE = "/yin-yang.png";

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

type PushPayload = {
  title?: string;
  body?: string;
  conversationId?: string;
  messageId?: string;
};

self.addEventListener("push", (event) => {
  let payload: PushPayload = {};
  try {
    if (event.data) {
      payload = event.data.json() as PushPayload;
    }
  } catch {
    payload = { body: event.data?.text() || "New message" };
  }

  const title = payload.title || "Friends Forever Chat";
  const body = payload.body || "New message";
  const tag = payload.messageId || payload.conversationId || "ffc-message";
  const conversationId = payload.conversationId || "";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const viewingChat = clients.some((client) => {
        try {
          const path = new URL(client.url).pathname;
          return (
            client.focused &&
            conversationId !== "" &&
            path === `/chat/${conversationId}`
          );
        } catch {
          return false;
        }
      });
      // App closed / backgrounded → always show. Only skip if that chat is open & focused.
      if (viewingChat) return;

      await self.registration.showNotification(title, {
        body,
        tag,
        icon: NOTIF_ICON,
        badge: NOTIF_BADGE,
        data: { conversationId: conversationId || "/" },
      } as NotificationOptions);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const conversationId = (
    event.notification.data as { conversationId?: string } | undefined
  )?.conversationId;
  const target =
    conversationId && conversationId !== "/"
      ? `/chat/${conversationId}`
      : "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.focus();
            client.postMessage({ type: "navigate", url: target });
            return;
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
