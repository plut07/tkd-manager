import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { createEvent } from "../actions";
import EventForm from "../EventForm";

export default async function NewEventPage() {
  await requirePermission(PERMISSIONS.EVENT_CREATE);
  // Organizer is picked from the clubs list, so the form needs it.
  const { data: clubs } = await supabaseAdmin().from("clubs").select("id, name").eq("active", true).order("name");

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900">New event</h1>
      <div className="mt-6">
        <EventForm action={createEvent} submitLabel="Create event" clubs={clubs ?? []} />
      </div>
    </div>
  );
}
