import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PHOTO_BUCKET } from "@/lib/eventPhotos";
import EventPhotos from "@/components/EventPhotos";
import { EVENT_TYPE_LABELS, CATEGORY_TYPES, type CategoryTypeCode } from "@/lib/eventCategories";
import { describeCriteria, type CategoryCriteria } from "@/lib/eligibility";
import { effectiveEventStatus, STATUS_STYLES, STATUS_LABELS, formatEventRange, formatEventDateTime } from "@/lib/eventStatus";
import CountryFlag from "@/components/CountryFlag";
import VenueMap from "@/components/VenueMap";

// These pages read live data but never touch cookies, so Next would otherwise
// prerender them at build time and keep serving that snapshot — edits and
// deletions wouldn't show until the next deploy. Force a fresh query per request.
export const dynamic = "force-dynamic";
export const revalidate = 0;


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
    .select("*, clubs:organizer_club_id(name)")
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

  const { data: photoRows } = await supabase
    .from("event_photos")
    .select("id, storage_path, caption, kind")
    .eq("event_id", params.id)
    .order("sort_order");
  const photos = (photoRows ?? []).map((p: any) => ({
    id: p.id,
    caption: p.caption ?? null,
    kind: (p.kind ?? "gallery") as "background" | "header" | "gallery",
    url: supabase.storage.from(PHOTO_BUCKET).getPublicUrl(p.storage_path).data.publicUrl,
  }));

  const { data: documents } = await supabase
    .from("event_documents")
    .select("*")
    .eq("event_id", event.id)
    .order("uploaded_at", { ascending: false });

  // Gradings take entries from the public straight into this system, so the
  // registration link can be shown to signed-out visitors. Every other event
  // type routes through the signed-in flow.
  const isGrading = event.event_type === "grading";

  const status = effectiveEventStatus(event);
  const registrationOpen = status === "upcoming" || status === "ongoing";

  const { data: publishedBrackets } = await supabase
    .from("event_category_brackets")
    .select("event_category_id")
    .eq("status", "published")
    .in("event_category_id", (categories ?? []).map((c) => c.id).length > 0 ? (categories ?? []).map((c) => c.id) : ["00000000-0000-0000-0000-000000000000"]);
  const publishedCategoryIds = new Set((publishedBrackets ?? []).map((b) => b.event_category_id));

  // Published grading results, for anyone with the link. Names and outcomes
  // only — the marks behind them stay with the organisers.
  const resultsPublished = isGrading && Boolean((event as any).results_published_at);
  let results: any[] = [];
  if (resultsPublished) {
    const { data: regs } = await supabase
      .from("event_registrations")
      .select("id, competition_number, clubs(name), event_categories(name), students(full_name)")
      .eq("event_id", event.id)
      .order("competition_number", { nullsFirst: false });
    const ids = (regs ?? []).map((r: any) => r.id);
    if (ids.length > 0) {
      const { data: scores } = await supabase
        .from("grading_exam_scores")
        .select("registration_id, passed, approved_rank")
        .in("registration_id", ids);
      const byReg = new Map((scores ?? []).map((s: any) => [s.registration_id, s]));
      results = (regs ?? [])
        .map((r: any) => ({ reg: r, score: byReg.get(r.id) }))
        .filter((x: any) => x.score)
        .sort((a: any, b: any) => (a.reg.students?.full_name ?? "").localeCompare(b.reg.students?.full_name ?? ""));
    }
  }

  const headerPhoto = photos.find((p) => p.kind === "header") ?? null;
  const backgroundPhoto = photos.find((p) => p.kind === "background") ?? null;

  return (
    <div className="space-y-6">
      {/* The background sits behind the whole page, dimmed hard so text on top
          of it stays readable whatever picture was uploaded. */}
      {backgroundPhoto && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.88), rgba(255,255,255,0.94)), url(${backgroundPhoto.url})` }}
        />
      )}

      {headerPhoto && (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={headerPhoto.url} alt={event.name} className="max-h-[28rem] w-full object-contain bg-gray-900" />
        </div>
      )}

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
              <span className={`badge ${STATUS_STYLES[effectiveEventStatus(event)] ?? "bg-gray-100 text-gray-500"}`}>{STATUS_LABELS[effectiveEventStatus(event)] ?? effectiveEventStatus(event)}</span>
              <span className="badge bg-brand-100 text-brand-700">{EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/public/events" className="btn-secondary">
              Back to events
            </Link>
            {registrationOpen && isGrading && (
              <Link href={`/public/events/${event.id}/register`} className="btn-primary">
                Registration
              </Link>
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
              {event.country && <CountryFlag country={event.country} showName={false} className="mr-1.5 align-[-2px]" />}{[event.venue, event.venue_address, event.country].filter(Boolean).join(", ") || "TBA"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Organizer</dt>
            <dd className="font-medium text-gray-900">{(event as any).clubs?.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Registration deadline</dt>
            <dd className="font-medium text-gray-900">{formatEventDateTime(event.registration_deadline)}</dd>
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
        {event.venue_address && <VenueMap address={event.venue_address} className="mt-4" />}

        {event.description && <p className="mt-4 whitespace-pre-line text-sm text-gray-700">{event.description}</p>}
      </div>

      {resultsPublished && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900">Results</h2>
          <p className="mt-1 text-sm text-gray-500">
            {results.filter((x: any) => x.score.passed === true).length} of {results.length} passed.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Name</th>
                  <th className="hidden sm:table-cell">Club</th>
                  <th>Promoted to</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {results.map(({ reg, score }: any) => (
                  <tr key={reg.id}>
                    <td>{reg.competition_number ?? "—"}</td>
                    <td className="font-medium text-gray-900">{reg.students?.full_name}</td>
                    <td className="hidden sm:table-cell">{reg.clubs?.name ?? "—"}</td>
                    <td>
                      {score.passed ? (
                        <span className="font-medium text-gray-900">{score.approved_rank ?? reg.event_categories?.name ?? "—"}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${score.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {score.passed ? "PASSED" : "FAILED"}
                      </span>
                    </td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-gray-400">No results to show.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EventPhotos eventId={params.id} photos={photos.filter((p) => p.kind === "gallery")} canEdit={false} />

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
