/** Backend URL in production (Railway). Empty in local Vite (uses proxy). */
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(
  /\/$/,
  ""
) || "";

export function apiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
