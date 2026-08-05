import webpush from "web-push";

export type PushPayload = {
  title: string;
  body: string;
  conversationId: string;
  messageId: string;
};

let pushReady = false;

export function initPush(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    console.warn(
      "Push notifications disabled — set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in server/.env"
    );
    return false;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:hello@friendforeverchat.app",
    publicKey,
    privateKey
  );
  pushReady = true;
  console.log("Push notifications: enabled");
  return true;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export async function sendPush(
  subscription: webpush.PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  if (!pushReady) return false;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return false;
    console.warn("Push send failed:", err);
    return false;
  }
}
