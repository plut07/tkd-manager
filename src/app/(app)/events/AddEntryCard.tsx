import { requirePermission, clubScope } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import RegisterStudentForm from "./RegisterStudentForm";
import { type CategoryCriteria } from "@/lib/eligibility";
import { registerStudent } from "./actions";
import { isRegistrationOpen, canOverrideLocks } from "@/lib/eventStatus";

/**
 * Putting somebody into the event.
 *
 * Sits at the top of the Registration tab, where a coach starts. A coach only
 * ever sees their own club's students — that scoping is applied here and
 * enforced again in the action, because a form is not a permission.
 */
export default async function AddEntryCard({ eventId }: { eventId: string }) {
  const session = await requirePermission(PERMISSIONS.EVENT_VIEW);
  const supabase = supabaseAdmin();
  const scope = clubScope(session);

  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  if (!event) return <div className="card p-6 text-sm text-gray-500">Event not found.</div>;

  const { data: categories } = await supabase
    .from("event_categories")
    .select("*")
    .eq("event_id", event.id)
    .order("sort_order")
    .order("name");

  const studentSelect = "id, full_name, club_id, clubs(name, country), gup, dan, gender, birthday, weight_kg, nationality";
  const query = supabase.from("students").select(studentSelect).eq("active", true).order("full_name");
  const { data: studentRows } = scope ? await query.eq("club_id", scope) : await query;
  const studentOptions = (studentRows as any) ?? [];

  const locked = !isRegistrationOpen(event) && !canOverrideLocks({ sub: session.sub, role: session.role }, event as any);

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-gray-900">Add an entry</h2>
      <p className="mt-1 text-sm text-gray-500">
        Pick the student first — only the categories they qualify for are offered.
      </p>

      {locked ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Registration has closed for this event. Entries are shown for reference and can no longer be changed.
        </p>
      ) : studentOptions.length > 0 ? (
        <RegisterStudentForm
          action={registerStudent}
          eventId={event.id}
          students={studentOptions}
          categories={(categories ?? []) as (CategoryCriteria & { id: string; name: string })[]}
          showClub={!scope}
          useCategories={event.event_type === "competition"}
          allowedCountries={event.allowed_countries ?? []}
          isGrading={event.event_type === "grading"}
        />
      ) : (
        <p className="mt-4 text-sm text-gray-500">No active students available to register.</p>
      )}

      <p className="mt-2 text-xs text-gray-400">
        New entries wait for approval on the Pending &amp; Approve tab. Approved competitors are given a competition
        number automatically.
      </p>
    </div>
  );
}
