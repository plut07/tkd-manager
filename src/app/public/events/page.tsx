import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { effectiveEventStatus } from "@/lib/eventStatus";
import { PHOTO_BUCKET } from "@/lib/eventPhotos";
import EventCard, { type EventCardData } from "@/components/EventCard";

// These pages read live data but never touch cookies, so Next would otherwise
// prerender them at build time and keep serving that snapshot — edits and
// deletions wouldn't show until the next deploy. Force a fresh query per request.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The event portal.
 *
 * Laid out the way the ITF's own listing is, because that is the page the sport
 * already knows: a banner, then what is coming up, then everything that has
 * been. Events are poster cards rather than table rows — at a glance somebody
 * is looking for their country's flag and a date, not reading a spreadsheet.
 *
 * Two sections rather than one list, because they answer different questions.
 * "Can I still enter this?" is only ever about what is ahead; "what happened at
 * that one?" is only ever about what is behind. A single list sorted by date
 * makes both of those harder.
 *
 * Draft events never appear. Everything else does, including finished ones —
 * an archive is the point of the second section.
 */
export default async function PublicEventsPage() {
  const supabase = supabaseAdmin();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, start_date, end_date, venue, country, status, event_type, registration_deadline")
    .in("status", ["upcoming", "ongoing", "completed", "cancelled"])
    .order("start_date", { ascending: true });

  const all = (events ?? []) as any[];

  // Posters and entry counts for every event in one query each, rather than one
  // per card — this page is forty cards on a busy year.
  const [{ data: photoRows }, { data: entryRows }] = await Promise.all([
    supabase.from("event_photos").select("event_id, storage_path, kind").in("kind", ["header", "background"]),
    supabase.from("event_registrations").select("event_id").eq("status", "confirmed"),
  ]);

  // A header photo is the intended poster; a background is the fallback, since
  // an organiser who uploaded only one of the two still meant it to be seen.
  const posterByEvent = new Map<string, string>();
  for (const kind of ["background", "header"]) {
    for (const p of ((photoRows ?? []) as any[]).filter((r) => r.kind === kind)) {
      posterByEvent.set(p.event_id, supabase.storage.from(PHOTO_BUCKET).getPublicUrl(p.storage_path).data.publicUrl);
    }
  }

  const entriesByEvent = new Map<string, number>();
  for (const r of (entryRows ?? []) as any[]) {
    entriesByEvent.set(r.event_id, (entriesByEvent.get(r.event_id) ?? 0) + 1);
  }

  const toCard = (e: any): EventCardData => ({
    ...e,
    posterUrl: posterByEvent.get(e.id) ?? null,
    entryCount: entriesByEvent.get(e.id) ?? 0,
  });

  const upcoming = all.filter((e) => effectiveEventStatus(e) !== "completed").map(toCard);
  // Most recent first: an archive is read backwards from now.
  const archive = all
    .filter((e) => effectiveEventStatus(e) === "completed")
    .reverse()
    .map(toCard);

  return (
    <div className="space-y-10">
      <Hero hasEvents={all.length > 0} />

      <Section title="Next events" count={upcoming.length} empty="Nothing scheduled at the moment. Check back soon.">
        {upcoming.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </Section>

      {archive.length > 0 && (
        <Section title="Events archive" count={archive.length} empty="">
          {archive.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Hero({ hasEvents }: { hasEvents: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 hero-bg px-6 py-12 text-center sm:py-16">
      <h1 className="text-2xl font-extrabold uppercase tracking-wide text-white drop-shadow sm:text-4xl">
        Taekwon-Do Events
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-white/80">
        Entries, draws, live scoring and results. Browse everything without signing in; sign in to enter your students.
      </p>
      {hasEvents && (
        <a
          href="#next-events"
          className="mt-6 inline-block rounded-md border border-white/40 bg-white/10 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white backdrop-blur transition hover:bg-white/20"
        >
          Browse events
        </a>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  const id = title.toLowerCase().replace(/\s+/g, "-");
  return (
    <section id={id}>
      <div className="flex items-center gap-4">
        <h2 className="whitespace-nowrap text-lg font-bold uppercase tracking-wide text-slate-800">{title}</h2>
        <span className="text-sm text-slate-400">{count}</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {count === 0 ? (
        // Said plainly rather than left as an empty grid, which reads as a page
        // that failed to load.
        <p className="mt-6 rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
          {empty}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">{children}</div>
      )}
    </section>
  );
}
