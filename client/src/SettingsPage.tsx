import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, type Theme } from "./AuthContext";
import type { Lang } from "./i18n";
import {
  disablePushNotifications,
  enablePushNotifications,
  isPushSubscribed,
  notificationPermission,
} from "./pwa";

const APK_PATH =
  (import.meta.env.VITE_APK_URL as string | undefined)?.trim() ||
  "/FriendsForeverChat.apk";

export function SettingsPage() {
  const { t, lang, setLanguage, theme, setTheme } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState(notificationPermission());
  const [pushOn, setPushOn] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [apkError, setApkError] = useState<string | null>(null);
  const [apkBusy, setApkBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const subscribed = await isPushSubscribed();
      if (!cancelled) {
        setPermission(notificationPermission());
        setPushOn(subscribed);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function pick(next: Lang) {
    if (next === lang) return;
    setBusy(true);
    setSaved(false);
    try {
      await setLanguage(next);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  function pickTheme(next: Theme) {
    if (next === theme) return;
    setTheme(next);
    setSaved(true);
  }

  async function downloadApk() {
    setApkError(null);
    setApkBusy(true);
    try {
      let available = false;
      try {
        const head = await fetch(APK_PATH, { method: "HEAD" });
        const type = head.headers.get("content-type") || "";
        available =
          head.ok &&
          !type.includes("text/html") &&
          Number(head.headers.get("content-length") || "1") > 1000;
      } catch {
        available = false;
      }
      if (!available) {
        const probe = await fetch(APK_PATH, {
          method: "GET",
          headers: { Range: "bytes=0-3" },
        });
        const type = probe.headers.get("content-type") || "";
        available =
          (probe.ok || probe.status === 206) && !type.includes("text/html");
      }
      if (!available) {
        setApkError(t.pwaDownloadMissing);
        return;
      }
      const a = document.createElement("a");
      a.href = APK_PATH;
      a.download = "FriendsForeverChat.apk";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setApkError(t.pwaDownloadMissing);
    } finally {
      setApkBusy(false);
    }
  }

  async function toggleNotifications() {
    setNotifBusy(true);
    setNotifError(null);
    setSaved(false);
    try {
      if (pushOn) {
        await disablePushNotifications();
        setPushOn(false);
        setPermission(notificationPermission());
      } else {
        const ok = await enablePushNotifications();
        setPermission(notificationPermission());
        const subscribed = await isPushSubscribed();
        setPushOn(subscribed);
        if (ok && subscribed) {
          setSaved(true);
        } else if (!ok && notificationPermission() !== "granted") {
          setNotifError(t.pwaNotificationsBlocked);
        } else if (!subscribed) {
          setNotifError(t.pwaNotificationsFailed);
        }
      }
    } catch (err) {
      setPermission(notificationPermission());
      setPushOn(await isPushSubscribed());
      setNotifError(
        err instanceof Error ? err.message : t.pwaNotificationsFailed
      );
    } finally {
      setNotifBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="ghost-btn">
          {t.back}
        </Link>
        <h1>{t.settings}</h1>
        <span />
      </header>

      <section className="settings-card">
        <h2>{t.languagePref}</h2>
        <p className="hint">{t.languageHelp}</p>

        <div className="lang-toggle wide" role="group" aria-label={t.language}>
          <button
            type="button"
            className={lang === "en" ? "active" : ""}
            disabled={busy}
            onClick={() => pick("en")}
          >
            {t.english}
          </button>
          <button
            type="button"
            className={lang === "zh" ? "active" : ""}
            disabled={busy}
            onClick={() => pick("zh")}
          >
            {t.chinese}
          </button>
        </div>
      </section>

      <section className="settings-card">
        <h2>{t.appearance}</h2>
        <p className="hint">{t.appearanceHelp}</p>

        <div
          className="lang-toggle wide theme-toggle"
          role="group"
          aria-label={t.appearance}
        >
          <button
            type="button"
            className={theme === "light" ? "active" : ""}
            onClick={() => pickTheme("light")}
          >
            {t.lightMode}
          </button>
          <button
            type="button"
            className={theme === "dark" ? "active" : ""}
            onClick={() => pickTheme("dark")}
          >
            {t.darkMode}
          </button>
        </div>
      </section>

      <section className="settings-card">
        <h2>{t.pwaTitle}</h2>
        <p className="hint">{t.pwaHelp}</p>

        <div className="pwa-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={apkBusy}
            onClick={downloadApk}
          >
            {apkBusy ? "…" : t.pwaInstall}
          </button>
          {apkError && <p className="hint">{apkError}</p>}

          <div className="pwa-install-guide">
            <h3>{t.pwaInstallStepsTitle}</h3>
            <ol>
              <li>{t.pwaInstallStep1}</li>
              <li>{t.pwaInstallStep2}</li>
              <li>{t.pwaInstallStep3}</li>
              <li>{t.pwaInstallStep4}</li>
            </ol>
            <p className="pwa-huawei-note">{t.pwaInstallHuawei}</p>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <h2>{t.pwaNotificationsTitle}</h2>
        <p className="hint">{t.pwaNotificationsHelp}</p>

        <div className="pwa-actions">
          {pushOn ? (
            <button
              type="button"
              className="ghost-btn"
              disabled={notifBusy}
              onClick={toggleNotifications}
            >
              {notifBusy ? "…" : t.pwaDisableNotifications}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={notifBusy || permission === "denied"}
              onClick={toggleNotifications}
            >
              {notifBusy ? "…" : t.pwaEnableNotifications}
            </button>
          )}

          {permission === "denied" && (
            <p className="hint">{t.pwaNotificationsBlocked}</p>
          )}
          {pushOn && <p className="saved-note">{t.pwaNotificationsOn}</p>}
          {notifError && <p className="hint">{notifError}</p>}
        </div>

        {saved && <p className="saved-note">{t.saved}</p>}
      </section>
    </div>
  );
}
