import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { FLASH_COOKIE } from "./flashCookie";
import { safeReturnPath } from "./returnPath";

/**
 * Telling somebody what went wrong.
 *
 * Sixty-odd server actions in this app end in a carefully worded sentence:
 * "A club with that name already exists", "Points can't be tied — enter a clear
 * winner", "Need at least 2 confirmed competitors in this category". Every one
 * of them was thrown as an Error, and in a production build Next replaces the
 * message of any error thrown on the server with
 *
 *     An error occurred in the Server Components render. The specific message
 *     is omitted in production builds to avoid leaking sensitive details.
 *
 * That is the right default — an unhandled crash can carry a connection string
 * — but it applied here too, so every one of those sentences reached the user
 * as a red "Something went wrong" page and a reference number. Somebody adding
 * a club that already existed was told nothing at all, and the page they were
 * working on was gone. The messages had been written; they were simply never
 * once seen.
 *
 * So a failure a person can *do something about* is not an exception. It goes
 * back to the page they were on, with the sentence in a banner:
 *
 *     await fail("A club with that name already exists.");
 *
 * The mechanics are a short-lived cookie plus a redirect. The redirect is what
 * makes it reliable — it forces a fresh render of the whole tree, so the banner
 * in the layout is guaranteed to be there, rather than depending on how much of
 * the tree Next chose to send back after the action.
 *
 * `fail` returns `never`, so it aborts the action exactly where `throw` did and
 * TypeScript's flow analysis is unchanged.
 *
 * Genuine faults — a query that should not have failed, a bug — should still be
 * thrown. Those *are* crashes, and the generic page is the correct answer.
 */

export { FLASH_COOKIE };

/**
 * Where to send them back to.
 *
 * A server action is POSTed to the URL of the page the form was on, and the
 * browser sends that URL as the Referer, so it is the page to return to. It is
 * also a header, so what it says is up to the caller — `safeReturnPath` is the
 * part that makes it safe to act on, and is tested on its own.
 */
function returnPath(): string {
  return safeReturnPath(headers().get("referer"), headers().get("host"));
}

/**
 * Abort the action and show `message` on the page they came from.
 *
 * Deliberately synchronous and declared `: never`, which is what lets it stand
 * in for `throw` without changing anything around it — TypeScript narrows after
 * a call to a never-returning function the same way it narrows after a throw,
 * so `if (!match) fail("Match not found."); match.id` still compiles. An async
 * version returns `Promise<never>`, which does not narrow, and every one of the
 * sixty call sites would have needed a `!` to compensate.
 *
 * (`cookies()` becomes async in Next 15; when that migration happens this has
 * to go back to async and those non-null assertions come back with it.)
 */
export function fail(message: string): never {
  cookies().set(FLASH_COOKIE, message, {
    path: "/",
    // Readable by the banner's script, which clears it as soon as it has been
    // shown. Nothing secret goes in here — it is a sentence written for the
    // person reading it.
    httpOnly: false,
    sameSite: "lax",
    // A backstop in case the script never runs. Long enough to survive the
    // redirect, short enough that a stale message can't reappear later.
    maxAge: 30,
  });
  redirect(returnPath());
}

/** The pending message, if there is one. Read during render. */
export function readFlash(): string | null {
  const value = cookies().get(FLASH_COOKIE)?.value?.trim();
  if (!value) return null;
  // Bounded: this is echoed into the page, and a cookie is client-writable.
  return value.slice(0, 400);
}
