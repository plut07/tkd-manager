/**
 * Turning a Referer header into somewhere it is safe to send someone.
 *
 * A failed action sends the user back to the page they were on, and the only
 * thing that knows which page that was is the Referer header — which is to say,
 * a value the caller chose. Handed straight to `redirect()` that is an open
 * redirect: a link to this app that quietly lands on somebody else's, which is
 * how a convincing phishing page gets a real domain in front of it.
 *
 * So: same host only, path and query only, never an origin and never a
 * fragment. Anything else falls back to the dashboard.
 *
 * Split out from `flash.ts` — which can't be imported outside a request — so
 * this can be tested directly. It is the security-carrying half.
 */
export function safeReturnPath(referer: string | null, host: string | null, fallback = "/"): string {
  if (!referer) return fallback;
  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    return fallback;
  }
  // Only ever http(s). A "javascript:" or "data:" referer is not a page.
  if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
  if (host && url.host !== host) return fallback;
  const path = url.pathname + url.search;
  // A path must start with a single slash. "//evil.com" is a protocol-relative
  // URL that browsers follow off-site, and it would survive everything above if
  // the referer were parsed loosely.
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}
