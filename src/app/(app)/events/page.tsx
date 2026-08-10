import Link from "next/link";
import { requirePermission, hasPermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { EVENT_TYPE_LABELS, EVENT_TYPES } from "@/lib/eventCategories";
import { effectiveEventStatus, STATUS_STYLES, STATUS_LABELS, formatEventRange } from "@/lib/eventStatus";
import CountryFlag from "@/components/CountryFlag";



export default async function EventsPage({ searchParams }: { searchParams: { q?: string; view?: string; type?: string; country?: string; from?: string; to?: string } }) {
  const session = await requirePermission(PERMISSIONS.EVENT_VIEW);
  const supabase = supabaseAdmin();

  const view = ["all", "upcoming", "ongoing", "completed"].includes(searchParams.view ?? "") ? searchParams.view! : "active";
  const { data: events } = await supabase
    .from("events")
    .select("id, name, start_date, end_date, venue, venue_address, country, status, event_type, registration_deadline, created_by, clubs:organizer_club_id(name)")
    .order("start_date", { ascending: false });

  // Filtering happens here rather than in the query because status is derived
  // from the dates, so the database can't express "upcoming" on its own.
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const from = (searchParams.from ?? "").trim();
  const to = (searchParams.to ?? "").trim();
  const searching = Boolean(q || from || to);

  const filtered = (events ?? []).filter((e: any) => {
    const status = effectiveEventStatus(e);
    // Completed events stay out of the way unless asked for — by tab, by name
    // search, or by date range.
    if (view === "active" && !searching && !(status === "upcoming" || status === "ongoing")) return false;
    if (view !== "active" && view !== "all" && status !== view) return false;
    if (q && !String(e.name ?? "").toLowerCase().includes(q)) return false;
    if (searchParams.type && e.event_type !== searchParams.type) return false;
    if (searchParams.country && e.country !== searchParams.country) return false;
    const day = e.start_date ? String(e.start_date).slice(0, 10) : "";
    if (from && day && day < from) return false;
    if (to && day && day > to) return false;
    return true;
  });

  const countries = Array.from(new Set((events ?? []).map((e: any) => e.country).filter(Boolean))).sort();
  const tabs = [
    { key: "active", label: "Upcoming & ongoing" },
    { key: "upcoming", label: "Upcoming" },
    { key: "ongoing", label: "Ongoing" },
    { key: "completed", label: "Completed" },
    { key: "all", label: "All" },
  ];

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

      <div className="mt-4 flex gap-2 overflow-x-auto border-b border-gray-200">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/events?view=${t.key}`}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
              view === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <form method="get" className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <input type="hidden" name="view" value={view} />
        <input name="q" defaultValue={searchParams.q} placeholder="Search event name..." className="input lg:col-span-2" />
        <select name="type" defaultValue={searchParams.type ?? ""} className="input">
          <option value="">All types</option>
          {EVENT_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
        </select>
        <select name="country" defaultValue={searchParams.country ?? ""} className="input">
          <option value="">All countries</option>
          {countries.map((c) => (<option key={String(c)} value={String(c)}>{String(c)}</option>))}
        </select>
        <input type="date" name="from" defaultValue={searchParams.from} className="input" title="From date" />
        <input type="date" name="to" defaultValue={searchParams.to} className="input" title="To date" />
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className="btn-secondary">Search</button>
          <Link href="/events" className="btn-secondary">Reset</Link>
          <span className="ml-auto self-center text-sm text-gray-500">{filtered.length} event{filtered.length === 1 ? "" : "s"}</span>
        </div>
      </form>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((e: any, i: number) => (
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
