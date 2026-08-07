import type { Lang } from "./i18n";

export function localeForLang(lang: Lang): string {
  return lang === "zh" ? "zh-CN" : "en-IN";
}

export function timeZoneForLang(lang: Lang): string {
  return lang === "zh" ? "Asia/Shanghai" : "Asia/Kolkata";
}

function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function isSameDay(
  a: string,
  b: string,
  lang: Lang
): boolean {
  const tz = timeZoneForLang(lang);
  return dayKey(a, tz) === dayKey(b, tz);
}

export function formatMessageTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(localeForLang(lang), {
    timeZone: timeZoneForLang(lang),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatDayLabel(
  iso: string,
  lang: Lang,
  labels: { today: string; yesterday: string }
): string {
  const tz = timeZoneForLang(lang);
  const locale = localeForLang(lang);
  const target = dayKey(iso, tz);
  const now = new Date();
  const today = dayKey(now.toISOString(), tz);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday = dayKey(y.toISOString(), tz);

  if (target === today) return labels.today;
  if (target === yesterday) return labels.yesterday;

  const date = new Date(iso);
  const [ty, tm, td] = today.split("-").map(Number);
  const [dy, dm, dd] = target.split("-").map(Number);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  const dayUtc = Date.UTC(dy, dm - 1, dd);
  const diffDays = Math.round((todayUtc - dayUtc) / 86400000);

  if (diffDays > 1 && diffDays < 7) {
    return new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      weekday: "long",
    }).format(date);
  }

  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
