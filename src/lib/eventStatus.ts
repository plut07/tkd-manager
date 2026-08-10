// Event status is derived from the event's dates rather than stored, so it is
// always correct the moment the date rolls over — no scheduled job to drift.
//
// "Today" is evaluated in Singapore time (UTC+8) regardless of where the server
// or the viewer happens to be, because that is the timezone the federation runs
// its calendar in. Vercel's servers run in UTC, so without this an event would
// flip to "ongoing" at 8am Singapore time rather than midnight.
//
// Draft and Cancelled are deliberate manual states, so they are never
// overridden — an organiser cancelling an event should not see it quietly
// become "ongoing" when the date arrives.

export const MANUAL_STATUSES = ["draft", "cancelled"] as const;

export const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500",
  upcoming: "bg-blue-100 text-blue-700",
  ongoing: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type EventDates = { status?: string | null; start_date?: string | null; end_date?: string | null };

/** Today's date in Singapore as YYYY-MM-DD. */
export function todayInSingapore(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which sorts correctly as a plain string.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * The Singapore calendar date for a value, as YYYY-MM-DD.
 *
 * Dates now arrive as timestamps in UTC, so slicing the first ten characters
 * would give the UTC day — at 00:30 Singapore time that is still *yesterday*.
 * Formatting in Asia/Singapore avoids an event flipping status eight hours late.
 */
function sgDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // A bare YYYY-MM-DD is already a calendar date; don't re-interpret it.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10) || null;
  return todayInSingapore(d);
}

/**
 * The status to show for an event.
 *
 * Multi-day events stay "ongoing" through their end date inclusive; if no end
 * date is set the event is treated as a single day.
 */
export function effectiveEventStatus(event: EventDates, now: Date = new Date()): string {
  const stored = (event.status ?? "").trim().toLowerCase();
  if ((MANUAL_STATUSES as readonly string[]).includes(stored)) return stored;

  const start = instant(event.start_date);
  if (!start) return stored || "upcoming";

  // Compared as exact moments, not calendar days: an event becomes Ongoing at
  // its start time and Completed once its end time has passed. Where no end
  // time is recorded, the event is treated as running to the end of its start
  // day in Singapore, so a morning event doesn't read as finished by lunchtime.
  const end = instant(event.end_date) ?? endOfSingaporeDay(start);

  if (now.getTime() < start.getTime()) return "upcoming";
  if (now.getTime() > end.getTime()) return "completed";
  return "ongoing";
}

/** Parses a timestamp (or bare date) into an instant. */
function instant(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // A bare date means midnight Singapore time, not midnight UTC.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00+08:00`) : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 23:59:59.999 Singapore time on the same day as the given instant. */
function endOfSingaporeDay(d: Date): Date {
  const day = todayInSingapore(d);
  return new Date(`${day}T23:59:59.999+08:00`);
}

/** True when the event has not finished yet. */
export function isActiveEvent(event: EventDates, now: Date = new Date()): boolean {
  const status = effectiveEventStatus(event, now);
  return status === "upcoming" || status === "ongoing";
}

export type EventGate = EventDates & { registration_deadline?: string | null; created_by?: string | null };
export type Viewer = { sub?: string | null; role?: string | null } | null | undefined;

/**
 * A Super Admin, or whoever created the event, can still make changes after a
 * cut-off. Everyone else is read-only from that point.
 */
export function canOverrideLocks(viewer: Viewer, event: EventGate): boolean {
  if (!viewer) return false;
  if (viewer.role === "super_admin") return true;
  return Boolean(viewer.sub && event.created_by && viewer.sub === event.created_by);
}

/**
 * Whether entries can still be added or amended.
 *
 * The deadline is an exact moment, so this is a straight instant comparison —
 * no timezone juggling needed. With no deadline set, entries stay open until
 * the event itself finishes.
 */
export function isRegistrationOpen(event: EventGate, now: Date = new Date()): boolean {
  const status = effectiveEventStatus(event, now);
  if (status === "cancelled" || status === "completed" || status === "draft") return false;
  const deadline = event.registration_deadline ? new Date(event.registration_deadline) : null;
  if (deadline && !Number.isNaN(deadline.getTime())) return now.getTime() <= deadline.getTime();
  return true;
}

/** Formats an event timestamp for display, in Singapore time. */
export function formatEventDateTime(value: string | null | undefined, withTime = true): string {
  if (!value) return "TBA";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(d);
}

/** Value for an <input type="datetime-local"> in Singapore time. */
export function toLocalInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Turn a datetime-local value (which the browser gives us with no zone) into an
 * instant, reading it as Singapore time — that is what the organiser meant.
 */
export function fromLocalInputValue(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const withTime = /T\d{2}:\d{2}/.test(v) ? v : `${v}T00:00`;
  const d = new Date(`${withTime}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * A start/end pair as one readable string. Same-day events collapse to a single
 * date with a time range; multi-day events show both dates.
 */
export function formatEventRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return "TBA";
  const startDay = todayInSingapore(new Date(start));
  const endDay = end ? todayInSingapore(new Date(end)) : null;
  if (!end || startDay === endDay) {
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(start));
    const base = formatEventDateTime(start, false);
    return time === "00:00" ? base : `${base}, ${time}`;
  }
  return `${formatEventDateTime(start, false)} – ${formatEventDateTime(end, false)}`;
}
