import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { createEvent } from "../actions";
import EventForm from "../EventForm";

export default async function NewEventPage() {
  await requirePermission(PERMISSIONS.EVENT_CREATE);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900">New event</h1>
      <div className="mt-6">
        <EventForm action={createEvent} submitLabel="Create event" />
      </div>
    </div>
  );
}
