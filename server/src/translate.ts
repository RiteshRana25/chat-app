import type { Lang } from "./types.js";

const MYMEMORY = "https://api.mymemory.translated.net/get";

const DEEPL_LANG: Record<Lang, string> = { en: "EN", zh: "ZH" };
const MYMEMORY_LANG: Record<Lang, string> = { en: "en", zh: "zh-CN" };

function looksChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

export function detectLang(text: string): Lang {
  return looksChinese(text) ? "zh" : "en";
}

function deeplEndpoint(apiKey: string): string {
  // Free keys usually end with :fx
  if (apiKey.endsWith(":fx") || process.env.DEEPL_API_URL) {
    return process.env.DEEPL_API_URL || "https://api-free.deepl.com/v2/translate";
  }
  return "https://api.deepl.com/v2/translate";
}

async function translateWithDeepL(
  text: string,
  to: Lang,
  from: Lang
): Promise<string | null> {
  const apiKey = process.env.DEEPL_API_KEY?.trim();
  if (!apiKey) return null;

  const body = new URLSearchParams({
    text,
    source_lang: DEEPL_LANG[from],
    target_lang: DEEPL_LANG[to],
  });

  const res = await fetch(deeplEndpoint(apiKey), {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn(`DeepL failed (${res.status}): ${errText.slice(0, 200)}`);
    return null;
  }

  const data = (await res.json()) as {
    translations?: { text?: string }[];
  };
  const translated = data.translations?.[0]?.text?.trim();
  return translated || null;
}

async function translateWithMyMemory(
  text: string,
  to: Lang,
  from: Lang
): Promise<string | null> {
  const url = new URL(MYMEMORY);
  url.searchParams.set("q", text);
  url.searchParams.set(
    "langpair",
    `${MYMEMORY_LANG[from]}|${MYMEMORY_LANG[to]}`
  );

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number;
  };

  const translated = data.responseData?.translatedText?.trim();
  if (!translated || data.responseStatus !== 200) return null;
  if (/^MYMEMORY WARNING/i.test(translated)) return null;
  return translated;
}

export async function translateText(
  text: string,
  to: Lang,
  from?: Lang
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;

  const source = from ?? detectLang(trimmed);
  if (source === to) return text;

  try {
    const deepl = await translateWithDeepL(trimmed, to, source);
    if (deepl) return deepl;

    const mymemory = await translateWithMyMemory(trimmed, to, source);
    if (mymemory) return mymemory;
  } catch (err) {
    console.warn("Translation error:", err);
  }

  return text;
}
