import Link from "next/link";
import CountryFlag from "@/components/CountryFlag";
import { EVENT_TYPE_LABELS } from "@/lib/eventCategories";
import { registrationBadge, REGISTRATION_STYLES, type RegistrationWindow } from "@/lib/registrationWindow";
import { formatEventRange } from "@/lib/eventStatus";

/**
 * One event on the portal.
 *
 * Laid out the way the ITF's own event listing does it, because that is the
 * page every coach and competitor in the sport already knows how to read: the
 * poster fills the card, the date sits top-left under the host's flag, and the
 * two things somebody is actually scanning for — what kind of event it is and
 * whether they can still enter — sit along the bottom as coloured badges.
 *
 * The poster does the work. An event without one still has to be legible, so
 * the artwork is a background rather than a element the layout depends on, and
 * everything sits on a gradient dark enough to read against whatever was
 * uploaded.
 */

export type EventCardData = RegistrationWindow & {
  id: string;
  name: string;
  start_date: string | null;
  end_date?: string | null;
  country?: string | null;
  event_type?: string | null;
  /** Poster artwork, if the organiser uploaded one. */
  posterUrl?: string | null;
  /** Shown when there are entries worth mentioning. */
  entryCount?: number | null;
};

export default function EventCard({ event }: { event: EventCardData }) {
  const badge = registrationBadge(event);
  const start = event.start_date ? new Date(event.start_date) : null;

  return (
    <Link
      href={`/public/events/${event.id}`}
      // A minimum height rather than a fixed aspect ratio. A ratio looked
      // tidier until a long event name wrapped to three lines in a narrow
      // column and pushed the registration badge — the most important thing on
      // the card — outside the box and out of sight. Grid stretches rows to
      // match anyway, so cards in a row still line up.
      className="group relative flex min-h-[17rem] flex-col overflow-hidden rounded-lg border border-white/10 bg-slate-800 shadow-lg transition hover:border-white/40 hover:shadow-xl"
    >
      {event.posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.posterUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.03]"
        />
      )}
      {/* Dark from the bottom up: the text lives down there, and a poster can be
          any colour at all. */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-900/20" />

      {/* Flag and date, top left — the two things you navigate by. */}
      <div className="relative flex items-start justify-between p-2">
        <div className="overflow-hidden rounded bg-slate-900/85 text-center shadow">
          {event.country && (
            <div className="px-2 pt-1.5">
              <CountryFlag country={event.country} showName={false} width={28} />
            </div>
          )}
          {start && (
            <div className="px-3 pb-1.5 pt-0.5 leading-none text-white">
              <div className="text-xl font-bold tabular-nums">{String(start.getDate()).padStart(2, "0")}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wide">
                {start.toLocaleString(undefined, { month: "short" })}
              </div>
              <div className="text-[10px] opacity-70">{start.getFullYear()}</div>
            </div>
          )}
        </div>

        {badge.state === "open" && (
          <span className="rounded bg-slate-900/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
            Register
          </span>
        )}
      </div>

      <div className="relative mt-auto space-y-1 p-3">
        <h3 className="line-clamp-3 text-sm font-bold uppercase leading-tight text-white drop-shadow">
          {event.name}
        </h3>
        <p className="text-[11px] text-white/70">{formatEventRange(event.start_date, event.end_date)}</p>

        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <span className="rounded bg-brand-700 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {EVENT_TYPE_LABELS[event.event_type ?? ""] ?? event.event_type ?? "Event"}
          </span>
          {event.entryCount != null && event.entryCount > 0 && (
            <span
              className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-white"
              title={`${event.entryCount} entered`}
            >
              {event.entryCount}
            </span>
          )}
        </div>

        {/* Wraps rather than truncates. In a narrow column "REG. ENDS IN 4 DAYS
            2 HOURS" was being cut to "...4 DAYS 2…", losing the part somebody
            is reading it for. Two short lines beat one clipped one. */}
        <span
          className={`mt-0.5 block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight tracking-wide ${REGISTRATION_STYLES[badge.state]}`}
        >
          {badge.label}
        </span>
      </div>
    </Link>
  );
}
