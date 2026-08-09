import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { EVENT_TYPE_LABELS, CATEGORY_TYPES, type CategoryTypeCode } from "@/lib/eventCategories";
import { describeCriteria, type CategoryCriteria } from "@/lib/eligibility";
import { effectiveEventStatus, STATUS_STYLES, STATUS_LABELS } from "@/lib/eventStatus";
import CountryFlag from "@/components/CountryFlag";


function formatDate(d: string | null) {
  if (!d) return "TBA";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

// Public, unauthenticated event detail page: event info + category
// requirements only. No registrant names/PII and no registration or
// editing controls are exposed here — those require signing in.
export default async function PublicEventDetailPage({ params }: { params: { id: string } }) {
  const supabase = supabaseAdmin();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", params.id)
    .in("status", ["upcoming", "ongoing", "completed", "cancelled"])
    .maybeSingle();
  if (!event) notFound();

  const { data: categories } = await supabase
    .from("event_categories")
    .select("*")
    .eq("event_id", event.id)
    .order("sort_order")
    .order("name");

  const { data: documents } = await supabase
    .from("event_documents")
    .select("*")
    .eq("event_id", event.id)
    .order("uploaded_at", { ascending: false });

  // Grading events register through a public Tally form, so the link can be
  // shown to signed-out visitors. Every other event type routes through the
  // signed-in registration flow.
  const isGrading = event.event_type === "grading";
  const { data: gradingForm } = isGrading
    ? await supabase.from("grading_forms").select("form_url").eq("event_id", event.id).maybeSingle()
    : { data: null };

  const status = effectiveEventStatus(event);
  const registrationOpen = status === "upcoming" || status === "ongoing";

  const { data: publishedBrackets } = await supabase
    .from("event_category_brackets")
    .select("event_category_id")
    .eq("status", "published")
    .in("event_category_id", (categories ?? []).map((c) => c.id).length > 0 ? (categories ?? []).map((c) => c.id) : ["00000000-0000-0000-0000-000000000000"]);
  const publishedCategoryIds = new Set((publishedBrackets ?? []).map((b) => b.event_category_id));

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
              <span className={`badge ${STATUS_STYLES[effectiveEventStatus(event)] ?? "bg-gray-100 text-gray-500"}`}>{STATUS_LABELS[effectiveEventStatus(event)] ?? effectiveEventStatus(event)}</span>
              <span className="badge bg-brand-100 text-brand-700">{EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}</span>
            </div>
            {event.discipline && <p className="mt-1 text-sm uppercase tracking-wide text-brand-600">{event.discipline}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/public/events" className="btn-secondary">
              Back to events
            </Link>
            {registrationOpen && isGrading && gradingForm?.form_url && (
              <a href={gradingForm.form_url} target="_blank" rel="noopener noreferrer" className="btn-primary">
                Register on the form
              </a>
            )}
            {registrationOpen && !isGrading && (
              <Link href={`/login?next=${encodeURIComponent(`/events/${event.id}/register`)}`} className="btn-primary">
                Sign in to register
              </Link>
            )}
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-gray-500">Dates</dt>
            <dd className="font-medium text-gray-900">
              {formatDate(event.start_date)}
              {event.end_date && event.end_date !== event.start_date ? ` – ${formatDate(event.end_date)}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Venue</dt>
            <dd className="font-medium text-gray-900">
              {event.country && <CountryFlag country={event.country} showName={false} className="mr-1.5 align-[-2px]" />}{[event.venue, event.city, event.country].filter(Boolean).join(", ") || "TBA"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Organizer</dt>
            <dd className="font-medium text-gray-900">{event.organizer || "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Registration deadline</dt>
            <dd className="font-medium text-gray-900">{formatDate(event.registration_deadline)}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <dt className="text-gray-500">Eligible countries</dt>
            <dd className="font-medium text-gray-900">
              {event.allowed_countries && event.allowed_countries.length > 0
                ? event.allowed_countries.join(", ")
                : "Open to every country"}
            </dd>
          </div>
        </dl>

        {event.description && <p className="mt-4 whitespace-pre-line text-sm text-gray-700">{event.description}</p>}
      </div>

      {event.event_type === "competition" && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900">Categories & divisions</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Eligibility</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(categories ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-gray-900">{c.name}</td>
                    <td>{CATEGORY_TYPES[c.type as CategoryTypeCode]?.label ?? c.type ?? "—"}</td>
                    <td className="text-gray-600">{describeCriteria(c as CategoryCriteria)}</td>
                    <td className="text-right">
                      {publishedCategoryIds.has(c.id) && (
                        <Link href={`/public/events/${event.id}/categories/${c.id}/bracket`} className="text-sm font-medium text-brand-700 hover:underline">
                          View bracket
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
                {(categories ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-gray-400">
                      No categories published yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
        <ul className="mt-4 divide-y divide-gray-100">
          {(documents ?? []).map((d) => (
            <li key={d.id} className="py-2">
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-700 hover:underline">
                {d.title}
              </a>
            </li>
          ))}
          {(documents ?? []).length === 0 && <li className="py-4 text-center text-gray-400">No documents uploaded.</li>}
        </ul>
      </div>

      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>{" "}
        to register students for this event.
      </p>
    </div>
  );
}
