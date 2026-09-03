import "server-only";

/**
 * Errors that are not errors.
 *
 * Next implements `redirect()` and `notFound()` by throwing. The throw is how
 * they work -- it unwinds out of your code and Next catches it at the top and
 * turns it into a redirect or a 404. Which means any `catch` between the two
 * silently cancels it.
 *
 * Every server action here is written as
 *
 *     try { await requirePermission(...); ...; return { ok: true } }
 *     catch (e) { return { error: ... } }
 *
 * so that a failure comes back as a message the screen can show rather than as
 * a crash. That shape is right, but it was also catching the redirect that
 * `requirePermission` throws when a session has expired. The user was not sent
 * to the login page; they were shown the literal string "NEXT_REDIRECT" and
 * left to work out what it meant. On a ring screen mid-event, that is a
 * scoreboard that has quietly stopped accepting anything with no way to tell
 * why.
 *
 * So a catch that means "turn a failure into a message" has to first let these
 * two back out.
 *
 * Identified by `digest` rather than by class: these are plain Errors carrying
 * a marker, and the marker is the only part of them Next treats as API.
 */
export function rethrowControlFlow(error: unknown): void {
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest !== "string") return;
  // NEXT_REDIRECT carries its destination and status after the marker.
  if (digest === "NEXT_NOT_FOUND" || digest.startsWith("NEXT_REDIRECT")) throw error;
}

/** The message to show for a genuine failure. */
export function messageFrom(error: unknown, fallback: string): string {
  rethrowControlFlow(error);
  return error instanceof Error ? error.message : fallback;
}
