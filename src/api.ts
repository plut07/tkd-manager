import type { Entry, ScoreMode, RingState, Side } from "./scoring";

/**
 * Talking to the scoreboard.
 *
 * One endpoint, and the join code is the whole authentication — the same
 * arrangement as the web judge page, because a referee at a table is not going
 * to create an account.
 */

export type Ring = {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  matchId: string | null;
  redName: string | null;
  blueName: string | null;
  redNumber: string | null;
  blueNumber: string | null;
  patternName: string | null;
  mode: ScoreMode;
  judgeCount: number;
  patternBase: number;
  roundSeconds: number;
  rounds: number;
  currentRound: number;
  state: RingState;
  clockStartedAt: string | null;
  clockRemaining: number;
  entries: Entry[];
};

export type Press = {
  clientId: string;
  code: string;
  judgeSlot: number;
  side: Side;
  value: number;
  kind: "point" | "deduction" | "flag";
  matchId: string | null;
  at: number;
};

/** Thrown when the request never reached the server. Anything else is an answer. */
export class Offline extends Error {
  constructor() {
    super("offline");
  }
}

/** Thrown when the bout a press belonged to is over. Retrying will never help. */
export class Stale extends Error {}

function normalise(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// A judge on a bad connection should find out in seconds, not wait on a socket
// that will never answer — the press is queued either way.
async function call(url: string, init: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new Offline();
  } finally {
    clearTimeout(timeout);
  }

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    // A gateway or captive portal answering with HTML is not the server
    // talking, so treat it the way an unreachable server is treated.
    throw new Offline();
  }

  if (response.status === 409 && body?.stale) throw new Stale(body.error ?? "That bout is over.");
  if (!response.ok) throw new Error(body?.error ?? `The server refused that (${response.status}).`);
  return body;
}

export async function fetchRing(base: string, code: string): Promise<Ring> {
  const body = await call(`${normalise(base)}/api/public/judge?code=${encodeURIComponent(code)}`, { method: "GET" });
  return body.ring as Ring;
}

export async function sendPress(base: string, press: Press): Promise<Ring> {
  const body = await call(`${normalise(base)}/api/public/judge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "press",
      code: press.code,
      judgeSlot: press.judgeSlot,
      side: press.side,
      value: press.value,
      kind: press.kind,
      clientId: press.clientId,
      matchId: press.matchId,
    }),
  });
  return body.ring as Ring;
}

export async function sendUndo(base: string, code: string, judgeSlot: number): Promise<Ring> {
  const body = await call(`${normalise(base)}/api/public/judge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "undo", code, judgeSlot }),
  });
  return body.ring as Ring;
}

/**
 * A name for one press, unique to this device.
 *
 * The server refuses a second press with the same name, which is what makes a
 * retry safe: a phone that lost signal mid-send has no way of knowing whether
 * the press landed, so it sends again and the database decides.
 */
export function pressId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
