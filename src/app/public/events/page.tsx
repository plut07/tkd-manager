import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { EVENT_TYPE_LABELS } from "@/lib/eventCategories";
import { effectiveEventStatus, STATUS_STYLES, STATUS_LABELS } from "@/lib/eventStatus";


function formatRange(start: string, end: string | null) {
  const s = new Date(start).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  if (!end || end === start) return s;
  const e = new Date(end).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return `${s} – ${e}`;
}

// Public, unauthenticated page: anyone with the link can browse upcoming
// and ongoing events without signing in. Draft events are never shown here.
export default async function PublicEventsPage() {
  const supabase = supabaseAdmin();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, discipline, start_date, end_date, venue, city, country, status, event_type")
    .in("status", ["upcoming", "ongoing", "completed", "cancelled"])
    .order("start_date", { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Upcoming events</h1>
      <p className="mt-1 text-sm text-gray-500">
        Browse event details and category requirements without signing in. Sign in to register students.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(events ?? []).map((e, i) => (
          <Link
            key={e.id}
            href={`/public/events/${e.id}`}
            className={`card border-l-4 p-5 hover:border-brand-300 ${i % 2 === 0 ? "border-l-blue-600" : "border-l-red-600"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-gray-900">{e.name}</h2>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`badge ${STATUS_STYLES[effectiveEventStatus(e)] ?? "bg-gray-100 text-gray-500"}`}>{STATUS_LABELS[effectiveEventStatus(e)] ?? effectiveEventStatus(e)}</span>
                <span className="badge bg-brand-100 text-brand-700">{EVENT_TYPE_LABELS[e.event_type] ?? e.event_type}</span>
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-500">{formatRange(e.start_date, e.end_date)}</p>
            <p className="mt-1 text-sm text-gray-500">
              {[e.venue, e.city, e.country].filter(Boolean).join(", ") || "Venue TBA"}
            </p>
            {e.discipline && <p className="mt-2 text-xs uppercase tracking-wide text-brand-600">{e.discipline}</p>}
          </Link>
        ))}
        {(events ?? []).length === 0 && (
          <p className="col-span-full py-10 text-center text-gray-400">No published events yet.</p>
        )}
      </div>
    </div>
  );
}
