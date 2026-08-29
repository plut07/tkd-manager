import type { Entry, ScoreMode, RingState, Side } from "./scoring";

/**
 * Talking to the scoreboard.
 *
 * One endpoint, and the join code is the whole authentication — the same
 * arrangement as the web judge page, because a referee at a table is not going
 * to create an account.
 */

/**
 * How the event wants its screens to look.
 *
 * Sent with the ring, so a change made on the web designer reaches this phone
 * on its next refresh. Every field is optional here and defaulted below — an
 * older server that doesn't send a theme must not leave a judge with a blank
 * screen mid-bout.
 */
export type Theme = {
  redColor: string;
  blueColor: string;
  background: string;
  textColor: string;
  accentColor: string;
  padDarkBackground: boolean;
};

export const DEFAULT_THEME: Theme = {
  redColor: "#b91c1c",
  blueColor: "#1d4ed8",
  background: "#0b0b12",
  textColor: "#ffffff",
  accentColor: "#facc15",
  padDarkBackground: false,
};

/** Only a plain hex value is used; anything else falls back. */
function colour(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

export function readTheme(raw: unknown): Theme {
  const t = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    redColor: colour(t.redColor, DEFAULT_THEME.redColor),
    blueColor: colour(t.blueColor, DEFAULT_THEME.blueColor),
    background: colour(t.background, DEFAULT_THEME.background),
    textColor: colour(t.textColor, DEFAULT_THEME.textColor),
    accentColor: colour(t.accentColor, DEFAULT_THEME.accentColor),
    padDarkBackground: t.padDarkBackground === true,
  };
}

/** Readable text on a given background — white on dark, near-black on light. */
export function contrastText(hex: string): string {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "#ffffff";
  const luma = (r * 299 + g * 587 + b * 114) / 1000;
  return luma > 150 ? "#111111" : "#ffffff";
}

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
  theme?: unknown;
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
