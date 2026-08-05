import { api } from "./api";

const PUSH_REGISTERED_KEY = "ffc_push_registered";
export const NOTIF_ICON = "/yin-yang.png";

let deferredInstall: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function initInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event("ffc-install-available"));
  });

  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    window.dispatchEvent(new Event("ffc-installed"));
  });
}

export function canInstallApp(): boolean {
  return deferredInstall !== null;
}

export function isStandaloneApp(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export async function promptInstallApp(): Promise<boolean> {
  if (!deferredInstall) return false;
  await deferredInstall.prompt();
  const { outcome } = await deferredInstall.userChoice;
  if (outcome === "accepted") deferredInstall = null;
  return outcome === "accepted";
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function notificationPermission(): NotificationPermission {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

function markPushRegistered(ok: boolean): void {
  if (ok) localStorage.setItem(PUSH_REGISTERED_KEY, "1");
  else localStorage.removeItem(PUSH_REGISTERED_KEY);
}

/** True only when browser subscription was successfully saved on the server. */
export async function isPushSubscribed(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }
  if (notificationPermission() !== "granted") return false;
  if (localStorage.getItem(PUSH_REGISTERED_KEY) !== "1") return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

export async function enablePushNotifications(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported in this browser.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    markPushRegistered(false);
    return false;
  }

  const { publicKey } = await api.getPushPublicKey();
  if (!publicKey) {
    markPushRegistered(false);
    throw new Error("Push notifications not configured on the server.");
  }

  const reg = await navigator.serviceWorker.ready;

  // Drop any old subscription so it matches the current VAPID key
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    try {
      await api.unsubscribePush(existing.endpoint);
    } catch {
      /* ignore — may not exist on server yet */
    }
    await existing.unsubscribe();
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });

  await api.subscribePush(sub.toJSON());
  markPushRegistered(true);
  return true;
}

export async function disablePushNotifications(): Promise<void> {
  markPushRegistered(false);
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    try {
      await api.unsubscribePush(sub.endpoint);
    } catch {
      /* still drop local subscription */
    }
    await sub.unsubscribe();
  }
}

export async function showMessageNotification(
  title: string,
  body: string,
  conversationId: string,
  messageId: string
): Promise<void> {
  if (Notification.permission !== "granted") return;

  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) {
    // No `badge` — Android renders badges as a white silhouette (white circle).
    await reg.showNotification(title, {
      body,
      tag: messageId,
      icon: NOTIF_ICON,
      data: { conversationId },
    });
    return;
  }

  new Notification(title, {
    body,
    tag: messageId,
    icon: NOTIF_ICON,
  });
}

export function listenForSwNavigation(
  onNavigate: (url: string) => void
): () => void {
  if (!("serviceWorker" in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    const data = event.data as { type?: string; url?: string } | undefined;
    if (data?.type === "navigate" && data.url) onNavigate(data.url);
  };

  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}
