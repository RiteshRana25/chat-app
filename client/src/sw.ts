/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { createHandlerBoundToURL } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;

const NOTIF_ICON = "/yin-yang.png";
const AUTH_DB = "ffc-sw-auth";
const AUTH_STORE = "kv";
const AUTH_KEY = "session";

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

type NotifData = {
  conversationId: string;
  bodies: string[];
  count: number;
};

type SwAuthSession = {
  token: string;
  lang: "en" | "zh";
  apiBase?: string;
};

async function readSwAuth(): Promise<SwAuthSession | null> {
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(AUTH_DB, 1);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(AUTH_STORE)) {
          database.createObjectStore(AUTH_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const session = await new Promise<SwAuthSession | null>((resolve, reject) => {
      const tx = db.transaction(AUTH_STORE, "readonly");
      const getReq = tx.objectStore(AUTH_STORE).get(AUTH_KEY);
      getReq.onsuccess = () =>
        resolve((getReq.result as SwAuthSession) || null);
      getReq.onerror = () => reject(getReq.error);
    });
    db.close();
    return session;
  } catch {
    return null;
  }
}

function replyLabels(lang: "en" | "zh") {
  return lang === "zh"
    ? { reply: "回复", placeholder: "输入回复…" }
    : { reply: "Reply", placeholder: "Type a reply…" };
}

async function showGroupedNotification(
  title: string,
  body: string,
  conversationId: string
): Promise<void> {
  const tag = `ffc-conv-${conversationId || "general"}`;
  const iconUrl = new URL(NOTIF_ICON, self.location.origin).href;
  const existing = await self.registration.getNotifications({ tag });
  const prev = existing[0];
  const prevData = (prev?.data || {}) as Partial<NotifData>;
  const bodies = [...(prevData.bodies || []), body].filter(Boolean).slice(-5);
  const count = (prevData.count || 0) + 1;
  const displayBody =
    count === 1 ? body : bodies.map((line) => `• ${line}`).join("\n");

  const session = await readSwAuth();
  const labels = replyLabels(session?.lang || "en");

  await self.registration.showNotification(title, {
    body: displayBody,
    tag,
    renotify: true,
    icon: iconUrl,
    data: {
      conversationId: conversationId || "/",
      bodies,
      count,
    } satisfies NotifData,
    actions: [
      {
        action: "reply",
        type: "text",
        title: labels.reply,
        placeholder: labels.placeholder,
      },
    ],
  } as NotificationOptions);
}

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
      if (viewingChat) return;

      await showGroupedNotification(title, body, conversationId);
    })()
  );
});

async function sendReplyFromNotification(
  conversationId: string,
  text: string
): Promise<boolean> {
  const session = await readSwAuth();
  if (!session?.token || !conversationId || conversationId === "/") {
    return false;
  }
  const base = (session.apiBase || "").replace(/\/$/, "");
  const url = `${base}/api/conversations/${conversationId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ text }),
  });
  return res.ok;
}

async function focusOrOpenChat(conversationId: string): Promise<void> {
  const target =
    conversationId && conversationId !== "/"
      ? `/chat/${conversationId}`
      : "/";
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of clients) {
    if ("focus" in client) {
      await client.focus();
      client.postMessage({ type: "navigate", url: target });
      return;
    }
  }
  await self.clients.openWindow(target);
}

self.addEventListener("notificationclick", (event) => {
  const data = (event.notification.data || {}) as Partial<NotifData>;
  const conversationId = data.conversationId || "/";
  const replyText = String(
    (event as NotificationEvent & { reply?: string }).reply || ""
  ).trim();

  if (event.action === "reply" && replyText) {
    event.waitUntil(
      (async () => {
        const ok = await sendReplyFromNotification(conversationId, replyText);
        event.notification.close();
        if (!ok) await focusOrOpenChat(conversationId);
      })()
    );
    return;
  }

  event.notification.close();
  event.waitUntil(focusOrOpenChat(conversationId));
});
