import Link from "next/link";
import { requirePermission, hasPermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { EVENT_TYPE_LABELS } from "@/lib/eventCategories";
import { effectiveEventStatus, STATUS_STYLES, STATUS_LABELS, formatEventRange } from "@/lib/eventStatus";
import CountryFlag from "@/components/CountryFlag";



export default async function EventsPage() {
  const session = await requirePermission(PERMISSIONS.EVENT_VIEW);
  const supabase = supabaseAdmin();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, start_date, end_date, venue, venue_address, country, status, event_type, registration_deadline, created_by, clubs:organizer_club_id(name)")
    .order("start_date", { ascending: false });

  const canCreate = hasPermission(session, PERMISSIONS.EVENT_CREATE);
  const canEdit = hasPermission(session, PERMISSIONS.EVENT_EDIT);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Events</h1>
          <p className="mt-1 text-sm text-gray-500">Calendar of competitions, seminars and gradings.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/public/events" className="btn-secondary">
            Public view
          </Link>
          {canCreate && (
            <Link href="/events/new" className="btn-primary">
              + New event
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(events ?? []).map((e, i) => (
          <div
            key={e.id}
            className={`card border-l-4 p-5 hover:border-brand-300 ${i % 2 === 0 ? "border-l-blue-600" : "border-l-red-600"}`}
          >
            <Link href={`/events/${e.id}`} className="block">
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
              {(e as any).clubs?.name && <p className="mt-2 text-xs uppercase tracking-wide text-brand-600">{(e as any).clubs.name}</p>}
            </Link>
            <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm">
              <Link href={`/events/${e.id}`} className="font-medium text-brand-700 hover:underline">
                View details
              </Link>
              {canEdit && (
                <Link href={`/events/${e.id}/edit`} className="font-medium text-gray-600 hover:underline">
                  Edit
                </Link>
              )}
            </div>
          </div>
        ))}
        {(events ?? []).length === 0 && (
          <p className="col-span-full py-10 text-center text-gray-400">No events yet.</p>
        )}
      </div>
    </div>
  );
}
