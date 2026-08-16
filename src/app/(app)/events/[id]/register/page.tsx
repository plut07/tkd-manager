import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { EVENT_TYPE_LABELS } from "@/lib/eventCategories";
import RegistrationPanel from "../../RegistrationPanel";

/**
 * Entering and approving people, on its own page.
 *
 * The same panel is a tab on the event's Registration page; this route stays
 * because links to it are already in use.
 */
export default async function EventRegisterPage({ params }: { params: { id: string } }) {
  await requirePermission(PERMISSIONS.EVENT_VIEW);
  const { data: event } = await supabaseAdmin().from("events").select("id, name, event_type").eq("id", params.id).maybeSingle();
  if (!event) notFound();

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Register for {event.name}</h1>
            <p className="mt-1 text-sm text-gray-500">{EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}</p>
          </div>
          <Link href={`/events/${event.id}?tab=registration`} className="btn-secondary">Back to event</Link>
        </div>
      </div>
      <RegistrationPanel eventId={event.id} />
    </div>
  );
}
