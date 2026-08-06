import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { updateEvent } from "../../actions";
import EventForm from "../../EventForm";

export default async function EditEventPage({ params }: { params: { id: string } }) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const supabase = supabaseAdmin();

  const { data: event } = await supabase.from("events").select("*").eq("id", params.id).maybeSingle();
  if (!event) notFound();

  const updateEventWithId = updateEvent.bind(null, event.id);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900">Edit event</h1>
      <div className="mt-6">
        <EventForm
          action={updateEventWithId}
          submitLabel="Save changes"
          defaultValues={{
            name: event.name,
            eventType: event.event_type,
            discipline: event.discipline ?? "",
            startDate: event.start_date,
            endDate: event.end_date ?? "",
            venue: event.venue ?? "",
            city: event.city ?? "",
            country: event.country ?? "",
            organizer: event.organizer ?? "",
            description: event.description ?? "",
            registrationDeadline: event.registration_deadline ?? "",
            status: event.status,
            allowedCountries: event.allowed_countries ?? [],
          }}
        />
      </div>
    </div>
  );
}
