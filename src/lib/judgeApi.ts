"use client";

import { type RingDto } from "@/app/(app)/events/scoreboardActions";
import { type QueuedPress, type SendOutcome } from "@/lib/pressQueue";

/**
 * The judge's pad talking to the ring.
 *
 * Over /api/public/judge rather than a server action, on purpose. A server
 * action is a framework call with its own headers and its own idea of what a
 * failure is; this is a plain POST that either reaches the server or doesn't,
 * which is the distinction the whole offline queue turns on. It is also the
 * same endpoint the Android build uses, so the two cannot drift apart on what a
 * press means.
 */

const ENDPOINT = "/api/public/judge";

/** The bout has moved on, or is over. Retrying will never help. */
const STALE = 409;

/**
 * The ring as this endpoint gives it back.
 *
 * Two fields short of the whole thing, deliberately: the endpoint does not echo
 * the join code or the event id, because a judge's device already has the code
 * and has no business knowing an internal id. The pad fills them back in from
 * what it was already holding — see JudgePad — so nothing downstream has to
 * care which route the ring arrived by.
 */
export type PublicRing = Omit<RingDto, "joinCode" | "eventId">;

export type JudgeReply = { ok: true; ring: PublicRing } | { ok: false; error: string; stale: boolean };

/**
 * Tell "the server said no" apart from "the server wasn't there".
 *
 * A refusal is final and the press should be dropped; an unreachable server is
 * temporary and the press must be kept. fetch only rejects for the second, so
 * the two are already distinct — this just makes that explicit at every call
 * site rather than leaving it to be remembered.
 */
async function post(body: unknown): Promise<JudgeReply | null> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // The pad is the only thing that should ever answer this. A cached reply
      // would show a judge a score from a bout that has since finished.
      cache: "no-store",
    });
  } catch {
    return null; // couldn't reach it
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    // A reply we can't read is still a reply — the request got there.
    return { ok: false, error: "The ring sent something unreadable back.", stale: false };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: String(payload?.error ?? "That didn't register."),
      stale: response.status === STALE || payload?.stale === true,
    };
  }
  return { ok: true, ring: payload.ring as PublicRing };
}

/** Send one press. Null means the server could not be reached. */
export async function sendPress(press: QueuedPress): Promise<JudgeReply | null> {
  return post({
    action: "press",
    code: press.code,
    judgeSlot: press.judgeSlot,
    side: press.side,
    value: press.value,
    kind: press.kind,
    clientId: press.clientId,
    matchId: press.matchId,
  });
}

/** The same, reduced to what the queue needs to decide whether to keep it. */
export async function deliver(press: QueuedPress): Promise<SendOutcome> {
  const reply = await sendPress(press);
  if (reply === null) return { kind: "offline" };
  if (reply.ok) return { kind: "landed" };
  return reply.stale ? { kind: "stale" } : { kind: "landed" };
  // A non-stale refusal is dropped too: it is something about the press itself
  // -- a judge number the ring doesn't have, a value it won't take -- and no
  // amount of resending will change the answer.
}

export async function sendUndo(code: string, judgeSlot: number): Promise<JudgeReply | null> {
  return post({ action: "undo", code, judgeSlot });
}
