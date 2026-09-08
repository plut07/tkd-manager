/**
 * What an event card says about registration.
 *
 * The badge along the bottom of each event on the portal, and the most useful
 * thing on the whole card: a coach scanning forty events is looking for the ones
 * they can still enter, and how long they have.
 *
 * Four states, because "open" and "closed" is not enough to be useful:
 *
 *   open      taking entries, and here is how long is left
 *   soon      published, but the window has not opened yet
 *   expired   the deadline has passed
 *   none      no deadline was set, so entries are handled off-system
 *
 * Deliberately plain — no database, no React — so the countdown can be checked
 * outright rather than by waiting a day to see whether it ticked.
 */

import { effectiveEventStatus, type EventGate } from "./eventStatus";

export type RegistrationState = "open" | "soon" | "expired" | "none";

export type RegistrationBadge = {
  state: RegistrationState;
  /** What the badge reads. */
  label: string;
  /** Milliseconds until the deadline, when there is one and it is ahead. */
  remainingMs: number | null;
};

/** A window that opens once entries are being taken and shuts at the deadline. */
export type RegistrationWindow = EventGate & { registration_opens_at?: string | null };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "5 DAYS 6 HOURS", "6 HOURS 12 MINUTES", "22 MINUTES".
 *
 * Two units, never three: the third is noise at every scale that matters, and
 * the badge has to fit on a card. Days and hours while there are days, hours
 * and minutes on the last day, minutes alone in the final hour — which is when
 * somebody is actually watching it.
 */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "";
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);

  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "S"}`;

  if (days > 0) return hours > 0 ? `${unit(days, "DAY")} ${unit(hours, "HOUR")}` : unit(days, "DAY");
  if (hours > 0) return minutes > 0 ? `${unit(hours, "HOUR")} ${unit(minutes, "MINUTE")}` : unit(hours, "HOUR");
  return unit(Math.max(1, minutes), "MINUTE");
}

/**
 * The badge for one event.
 *
 * A finished or cancelled event is never "open", whatever its deadline says —
 * the deadline is about entries and the event itself has already answered the
 * question.
 */
export function registrationBadge(event: RegistrationWindow, now: Date = new Date()): RegistrationBadge {
  const status = effectiveEventStatus(event, now);
  const deadline = parse(event.registration_deadline);
  const opens = parse(event.registration_opens_at);

  if (status === "cancelled") return { state: "expired", label: "CANCELLED", remainingMs: null };
  if (status === "completed") return { state: "expired", label: "REGISTRATION CLOSED", remainingMs: null };

  // No deadline recorded means entries are not run through this system — which
  // is a real answer, and a different one from "you are too late".
  if (!deadline) return { state: "none", label: "NO ONLINE REGISTRATION", remainingMs: null };

  if (opens && now.getTime() < opens.getTime()) {
    const until = opens.getTime() - now.getTime();
    return { state: "soon", label: `REGISTRATION OPENS IN ${formatRemaining(until)}`, remainingMs: until };
  }

  const left = deadline.getTime() - now.getTime();
  if (left <= 0) return { state: "expired", label: "REGISTRATION EXPIRED", remainingMs: null };

  return { state: "open", label: `REG. ENDS IN ${formatRemaining(left)}`, remainingMs: left };
}

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The colour each state wears, kept here so card and legend cannot disagree. */
export const REGISTRATION_STYLES: Record<RegistrationState, string> = {
  open: "bg-emerald-600 text-white",
  soon: "bg-amber-500 text-white",
  expired: "bg-red-700 text-white",
  none: "bg-slate-600 text-white",
};
