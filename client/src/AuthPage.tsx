import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";
import { BlossomScene } from "./BlossomScene";
import { BrandLogo } from "./BrandLogo";
import type { Lang } from "./i18n";

export function AuthPage() {
  const { login, register, t, lang, setUiLang } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState<Lang>(lang);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (
      !email.trim() ||
      !password ||
      (mode === "register" && !displayName.trim())
    ) {
      setError(t.required);
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, displayName.trim(), language);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      if (/already registered/i.test(msg)) setError(t.emailTaken);
      else if (/Invalid/i.test(msg)) setError(t.invalidCredentials);
      else setError(msg);
    } finally {
      setBusy(false);
    }
  }

  function pickLang(next: Lang) {
    setLanguage(next);
    setUiLang(next);
  }

  return (
    <div className="auth-shell">
      <BlossomScene density={32} />

      <div className="auth-layout">
        <section className="auth-hero">
          <BrandLogo size="lg" className="brand-logo-hero" />
          <p className="brand-mark">{t.brand}</p>
          <p className="brand-tag">{t.tagline}</p>
        </section>

        <section className="auth-panel">
          <div className="lang-toggle" role="group" aria-label={t.language}>
            <button
              type="button"
              className={language === "en" ? "active" : ""}
              onClick={() => pickLang("en")}
            >
              {t.english}
            </button>
            <button
              type="button"
              className={language === "zh" ? "active" : ""}
              onClick={() => pickLang("zh")}
            >
              {t.chinese}
            </button>
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
            <h1>{mode === "login" ? t.login : t.register}</h1>

            {mode === "register" && (
              <label>
                <span>{t.displayName}</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="nickname"
                />
              </label>
            )}

            <label>
              <span>{t.email}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>

            <label>
              <span>{t.password}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </label>

            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="btn-primary" disabled={busy}>
              {mode === "login" ? t.submitLogin : t.submitRegister}
            </button>
          </form>

          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? t.switchToRegister : t.switchToLogin}
          </button>
        </section>
      </div>
    </div>
  );
}
