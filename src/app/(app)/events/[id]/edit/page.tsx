import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { updateEvent } from "../../actions";
import EventForm from "../../EventForm";
import { effectiveEventStatus, canOverrideLocks, toLocalInputValue } from "@/lib/eventStatus";

export default async function EditEventPage({ params }: { params: { id: string } }) {
  const session = await requirePermission(PERMISSIONS.EVENT_EDIT);
  const supabase = supabaseAdmin();

  const { data: event } = await supabase.from("events").select("*").eq("id", params.id).maybeSingle();
  if (!event) notFound();

  // Mirrors the server-side guard so the form isn't even offered.
  if (effectiveEventStatus(event) === "completed" && !canOverrideLocks({ sub: session.sub, role: session.role }, event)) {
    throw new Error("This event has finished. Only a Super Admin or the person who created it can change it now.");
  }

  const { data: clubs } = await supabase.from("clubs").select("id, name").eq("active", true).order("name");

  const updateEventWithId = updateEvent.bind(null, event.id);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900">Edit event</h1>
      <div className="mt-6">
        <EventForm
          action={updateEventWithId}
          submitLabel="Save changes"
          clubs={clubs ?? []}
          defaultValues={{
            name: event.name,
            eventType: event.event_type,
            startDate: toLocalInputValue(event.start_date),
            endDate: toLocalInputValue(event.end_date),
            venue: event.venue ?? "",
            country: event.country ?? "",
            organizerClubId: event.organizer_club_id ?? "",
            venueAddress: event.venue_address ?? "",
            description: event.description ?? "",
            registrationDeadline: toLocalInputValue(event.registration_deadline),
            status: event.status,
            allowedCountries: event.allowed_countries ?? [],
          }}
        />
      </div>
    </div>
  );
}
