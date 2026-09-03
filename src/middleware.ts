import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
// `/.well-known` is fetched by Android to check that this site vouches for the
// judge app, and `/sw.js` and `/manifest.webmanifest` are what make that app
// installable in the first place. All three are requested by a phone with no
// session, so a redirect to the login page would simply read as "not
// installable" with nothing to say why.
const PUBLIC_PREFIXES = [
  "/login", "/public", "/_next", "/favicon.ico", "/icons",
  "/api/health", "/api/grading-webhook", "/api/public",
  "/.well-known", "/sw.js", "/manifest.webmanifest",
];
async function isValidToken(token: string | undefined) {
  if (!token) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  try { await jwtVerify(token, new TextEncoder().encode(secret)); return true; } catch { return false; }
}
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = await isValidToken(token);
  if (!valid) { const loginUrl = new URL("/login", request.url); if (pathname !== "/") loginUrl.searchParams.set("next", pathname); return NextResponse.redirect(loginUrl); }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
