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

/** A size a person can judge a download by. */
export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
