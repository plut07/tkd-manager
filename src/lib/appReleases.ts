/**
 * The judge app's installable file.
 *
 * Kept out of the server-action file because a "use server" module may only
 * export async functions — a plain constant there fails the build.
 */
export const RELEASE_BUCKET = "app-releases";

/** Android only for now: an iOS build needs a paid Apple account. */
export type Platform = "android" | "ios";

export const MAX_RELEASE_BYTES = 150 * 1024 * 1024;

/**
 * A download address we are willing to send a judge to.
 *
 * The whole point of this feature is that a build can live on GitHub, so the
 * address can't be restricted to this site. What it can be restricted to is
 * https — an http link would have judges installing an APK that anyone on the
 * hall's wifi could have swapped on the way.
 *
 * Returns the tidied address, or null.
 */
export function safeDownloadUrl(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** The file name at the end of a download address, for showing on the page. */
export function fileNameFromUrl(url: string): string {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
    return decodeURIComponent(last) || "download";
  } catch {
    return "download";
  }
}

/** A size a person can judge a download by. */
export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
