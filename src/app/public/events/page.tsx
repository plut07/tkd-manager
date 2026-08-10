import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { EVENT_TYPE_LABELS } from "@/lib/eventCategories";
import { effectiveEventStatus, STATUS_STYLES, STATUS_LABELS, formatEventRange, isActiveEvent } from "@/lib/eventStatus";
import CountryFlag from "@/components/CountryFlag";

// These pages read live data but never touch cookies, so Next would otherwise
// prerender them at build time and keep serving that snapshot — edits and
// deletions wouldn't show until the next deploy. Force a fresh query per request.
export const dynamic = "force-dynamic";
export const revalidate = 0;



// Public, unauthenticated page: anyone with the link can browse upcoming
// and ongoing events without signing in. Draft events are never shown here.
export default async function PublicEventsPage() {
  const supabase = supabaseAdmin();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, start_date, end_date, venue, country, status, event_type")
    .in("status", ["upcoming", "ongoing", "completed", "cancelled"])
    .order("start_date", { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Upcoming events</h1>
      <p className="mt-1 text-sm text-gray-500">
        Browse event details and category requirements without signing in. Sign in to register students.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Signed-out visitors see only what is still to come or running now;
              finished events are visible once signed in. */}
        {(events ?? []).filter((e: any) => isActiveEvent(e)).map((e: any, i: number) => (
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
            <p className="mt-1 text-sm text-gray-500">{formatEventRange(e.start_date, e.end_date)}</p>
            <p className="mt-1 text-sm text-gray-500">
              {e.country && <CountryFlag country={e.country} showName={false} className="mr-1.5 align-[-2px]" />}{[e.venue, e.country].filter(Boolean).join(", ") || "Venue TBA"}
            </p>
            
          </Link>
        ))}
        {(events ?? []).filter((e: any) => isActiveEvent(e)).length === 0 && (
          <p className="col-span-full py-10 text-center text-gray-400">No published events yet.</p>
        )}
      </div>
    </div>
  );
}
