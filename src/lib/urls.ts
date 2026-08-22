import { headers } from "next/headers";

/**
 * Where this site is being served from, as seen by the person using it.
 *
 * Judges join by typing an address into a phone, so the link an organiser reads
 * out has to be the real one — the preview deployment when they're testing, the
 * custom domain in the hall. Taking it from the request gets that right without
 * anything to configure.
 */
export function baseUrl(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
