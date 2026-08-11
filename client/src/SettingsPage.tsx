import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, type Theme } from "./AuthContext";
import type { Lang } from "./i18n";
import {
  canInstallApp,
  disablePushNotifications,
  enablePushNotifications,
  isPushSubscribed,
  isStandaloneApp,
  notificationPermission,
  promptInstallApp,
} from "./pwa";

export function SettingsPage() {
  const { t, lang, setLanguage, theme, setTheme } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installReady, setInstallReady] = useState(canInstallApp());
  const [installed, setInstalled] = useState(isStandaloneApp());
  const [permission, setPermission] = useState(notificationPermission());
  const [pushOn, setPushOn] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);

  useEffect(() => {
    const onInstall = () => setInstallReady(canInstallApp());
    const onInstalled = () => {
      setInstalled(true);
      setInstallReady(false);
    };
    window.addEventListener("ffc-install-available", onInstall);
    window.addEventListener("ffc-installed", onInstalled);
    return () => {
      window.removeEventListener("ffc-install-available", onInstall);
      window.removeEventListener("ffc-installed", onInstalled);
    };
  }, []);

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

  async function downloadApp() {
    const ok = await promptInstallApp();
    if (ok) setInstalled(true);
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
        <h2>{installed ? t.pwaNotificationsTitle : t.pwaTitle}</h2>
        <p className="hint">
          {installed ? t.pwaNotificationsHelp : t.pwaHelp}
        </p>

        <div className="pwa-actions">
          {!installed && (
            <button type="button" className="btn-primary" onClick={downloadApp}>
              {t.pwaInstall}
            </button>
          )}

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
