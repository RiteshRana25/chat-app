/** Keep auth token/lang in IndexedDB so the service worker can reply from notifications. */

const DB_NAME = "ffc-sw-auth";
const STORE = "kv";
const KEY = "session";

export type SwAuthSession = {
  token: string;
  lang: "en" | "zh";
  apiBase: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSwAuth(
  token: string | null,
  lang: "en" | "zh" = "en",
  apiBase = ""
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      if (token) {
        store.put({ token, lang, apiBase } satisfies SwAuthSession, KEY);
      } else store.delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore — reply-from-notification will fall back */
  }
}

export async function readSwAuth(): Promise<SwAuthSession | null> {
  try {
    const db = await openDb();
    const session = await new Promise<SwAuthSession | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as SwAuthSession) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return session;
  } catch {
    return null;
  }
}
