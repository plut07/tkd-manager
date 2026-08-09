import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { EVENT_TYPE_LABELS } from "@/lib/eventCategories";
import { effectiveEventStatus, STATUS_STYLES, STATUS_LABELS, formatEventRange, formatEventDateTime, isRegistrationOpen } from "@/lib/eventStatus";
import CountryFlag from "@/components/CountryFlag";
import VenueMap from "@/components/VenueMap";

// These pages read live data but never touch cookies, so Next would otherwise
// prerender them at build time and keep serving that snapshot — edits and
// deletions wouldn't show until the next deploy. Force a fresh query per request.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public registration page for grading events only.
 *
 * Gradings take entries from the general public through a Tally form, so this
 * page is reachable signed-out. Every other event type registers through the
 * signed-in flow and is redirected to the login page instead. No registrant
 * names appear here — only the event's own details and the form link.
 */
export default async function PublicEventRegisterPage({ params }: { params: { id: string } }) {
  const supabase = supabaseAdmin();

  const { data: event } = await supabase
    .from("events")
    .select("*, clubs:organizer_club_id(name)")
    .eq("id", params.id)
    .in("status", ["upcoming", "ongoing", "completed", "cancelled"])
    .maybeSingle();
  if (!event) notFound();

  // Anything that isn't a grading keeps its entries behind a login.
  if (event.event_type !== "grading") {
    return (
      <div className="card mx-auto max-w-lg p-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900">Sign in to register</h1>
        <p className="mt-2 text-sm text-gray-600">
          Entries for {event.name} are made by clubs through their account.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href={`/login?next=${encodeURIComponent(`/events/${event.id}/register`)}`} className="btn-primary">Sign in</Link>
          <Link href={`/public/events/${event.id}`} className="btn-secondary">Back to event</Link>
        </div>
      </div>
    );
  }

  const { data: gradingForm } = await supabase
    .from("grading_forms")
    .select("form_url")
    .eq("event_id", event.id)
    .maybeSingle();

  const status = effectiveEventStatus(event);
  const open = isRegistrationOpen(event);


  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
              <span className={`badge ${STATUS_STYLES[status] ?? "bg-gray-100 text-gray-500"}`}>{STATUS_LABELS[status] ?? status}</span>
              <span className="badge bg-brand-100 text-brand-700">{EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}</span>
            </div>
            <p className="mt-1 text-sm text-gray-500">Grading registration</p>
          </div>
          <Link href={`/public/events/${event.id}`} className="btn-secondary">Event details</Link>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Date</dt>
            <dd className="font-medium text-gray-900">
              {formatEventRange(event.start_date, event.end_date)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Venue</dt>
            <dd className="font-medium text-gray-900">
              {event.country && <CountryFlag country={event.country} showName={false} className="mr-1.5 align-[-2px]" />}
              {[event.venue, event.venue_address, event.country].filter(Boolean).join(", ") || "TBA"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Registration deadline</dt>
            <dd className="font-medium text-gray-900">{formatEventDateTime(event.registration_deadline)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Organizer</dt>
            <dd className="font-medium text-gray-900">{(event as any).clubs?.name || "—"}</dd>
          </div>
        </dl>
        {event.venue_address && <VenueMap address={event.venue_address} className="mt-4" />}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">How to register</h2>
        {!open ? (
          <p className="mt-2 text-sm text-gray-600">
            Registration for this grading is closed{status === "cancelled" ? " — the event was cancelled." : "."}
          </p>
        ) : gradingForm?.form_url ? (
          <>
            <p className="mt-2 text-sm text-gray-600">
              Fill in the registration form below. Your instructor will confirm your entry once it has been reviewed.
            </p>
            <a href={gradingForm.form_url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 inline-flex">
              Open registration form
            </a>
            <p className="mt-3 break-all text-xs text-gray-400">{gradingForm.form_url}</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            The registration form for this grading hasn&apos;t been published yet. Please check back closer to the date.
          </p>
        )}
      </div>

      {event.description && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900">Details</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{event.description}</p>
        </div>
      )}
    </div>
  );
}
