import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { Lang } from "./i18n";

export function SettingsPage() {
  const { t, lang, setLanguage, user } = useAuth();
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

        {saved && <p className="saved-note">{t.saved}</p>}
      </section>
    </div>
  );
}
