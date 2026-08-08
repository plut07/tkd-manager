import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
const PUBLIC_PREFIXES = ["/login", "/public", "/_next", "/favicon.ico", "/api/health", "/api/grading-webhook"];
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
