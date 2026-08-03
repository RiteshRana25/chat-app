import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, type Theme } from "./AuthContext";
import type { Lang } from "./i18n";

export function SettingsPage() {
  const { t, lang, setLanguage, theme, setTheme, user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

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
        <p className="muted">{user?.email}</p>

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

        {saved && <p className="saved-note">{t.saved}</p>}
      </section>
    </div>
  );
}
