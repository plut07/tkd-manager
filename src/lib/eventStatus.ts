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

/** Normalises a date column to YYYY-MM-DD, tolerating a full timestamp. */
function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed.length >= 10 ? trimmed.slice(0, 10) : null;
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

  const start = dateOnly(event.start_date);
  if (!start) return stored || "upcoming";
  const end = dateOnly(event.end_date) ?? start;
  const today = todayInSingapore(now);

  if (today < start) return "upcoming";
  if (today > end) return "completed";
  return "ongoing";
}

/** True when the event is upcoming or ongoing today. */
export function isActiveEvent(event: EventDates, now: Date = new Date()): boolean {
  const status = effectiveEventStatus(event, now);
  return status === "upcoming" || status === "ongoing";
}
