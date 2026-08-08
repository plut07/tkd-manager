import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./session";
import { SUPER_ADMIN_ROLE, type PermissionCode } from "./permissions";

export function hasPermission(session: SessionPayload | null, code: PermissionCode): boolean {
  if (!session) return false;
  if (session.role === SUPER_ADMIN_ROLE) return true;
  return session.permissions.includes(code);
}

/** Redirects to /login if there is no valid session. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Redirects to /login if unauthenticated, and throws a plain Error if the
 * user lacks the given permission (caught by the nearest error boundary).
 */
export async function requirePermission(code: PermissionCode): Promise<SessionPayload> {
  const session = await requireSession();
  if (!hasPermission(session, code)) {
    throw new Error(`You don't have permission to do this (missing "${code}").`);
  }
  return session;
}

/** Scope filter helper: club_admin users are restricted to their own club. */
export function clubScope(session: SessionPayload): string | null {
  if (session.role === SUPER_ADMIN_ROLE) return null;
  if (session.role === "event_manager") return null;
  return session.clubId;
}

export async function requireSuperAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== SUPER_ADMIN_ROLE) {
    throw new Error("Only Super Admins can manage roles and access rights.");
  }
  return session;
}
