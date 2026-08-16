import { requirePermission, hasPermission, clubScope } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import RegisterStudentForm from "./RegisterStudentForm";
import ClubExportButton from "@/components/ClubExportButton";
import { type CategoryCriteria, computeAge } from "@/lib/eligibility";
import { registerStudent, unregisterStudent, approveRegistration } from "./actions";
import { isRegistrationOpen, canOverrideLocks } from "@/lib/eventStatus";

/**
 * Entering people and approving them.
 *
 * Lives here rather than on its own page so it can sit as a tab beside the
 * registered-students list; /events/[id]/register renders the same component,
 * because links to it are already out in the wild.
 */
export default async function RegistrationPanel({ eventId }: { eventId: string }) {
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

  const { data: registrations } = await supabase
    .from("event_registrations")
    .select(
      "id, status, registered_at, competition_number, clubs(id, name), students(id, full_name, gender, weight_kg, height_cm, birthday, nationality), event_categories(id, name)"
    )
    .eq("event_id", event.id)
    .order("registered_at");

  const studentSelect =
    "id, full_name, club_id, clubs(name, country), gup, dan, gender, birthday, weight_kg, nationality";
  let studentOptions: any[] = [];
  if (scope) {
    const { data } = await supabase.from("students").select(studentSelect).eq("club_id", scope).eq("active", true).order("full_name");
    studentOptions = (data as any) ?? [];
  } else {
    const { data } = await supabase.from("students").select(studentSelect).eq("active", true).order("full_name");
    studentOptions = (data as any) ?? [];
  }

  const canEditRaw = hasPermission(session, PERMISSIONS.EVENT_EDIT);
  // Entries close at the registration deadline, not when the event runs.
  const locked = !isRegistrationOpen(event) && !canOverrideLocks({ sub: session.sub, role: session.role }, event as any);
  const canEdit = canEditRaw && !locked;
  const canManageAll = session.role === "super_admin" || session.role === "event_manager";

  const pending = ((registrations ?? []) as any[]).filter((r) => r.status === "pending");
  const confirmed = ((registrations ?? []) as any[]).filter((r) => r.status === "confirmed");

  const byClub = new Map<string, { clubName: string; rows: any[] }>();
  for (const r of confirmed) {
    const key = r.clubs?.id ?? "unknown";
    if (!byClub.has(key)) byClub.set(key, { clubName: r.clubs?.name ?? "Unknown club", rows: [] });
    byClub.get(key)!.rows.push(r);
  }
  const clubGroups = Array.from(byClub.values()).sort((a, b) => a.clubName.localeCompare(b.clubName));

  function canRemove(clubId: string | null) {
    return canManageAll || clubId === session.clubId;
  }
  const fmtWeight = (kg: number | null) => (kg ? `${kg} kg` : "—");
  const fmtHeight = (cm: number | null) => (cm ? `${cm} cm` : "—");

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">Add an entry</h2>
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
          New entries wait in the pending list below until an organizer approves them. Approved competitors are given a
          competition number automatically.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">Pending approval ({pending.length})</h2>
        <p className="mt-1 text-sm text-gray-500">Entries waiting for an organizer to confirm.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>No.</th><th>Student</th><th>Club</th><th>Category</th><th>Age</th><th>Weight</th><th>Height</th><th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.competition_number ?? "—"}</td>
                  <td>{r.students?.full_name}</td>
                  <td>{r.clubs?.name ?? "—"}</td>
                  <td>{r.event_categories?.name ?? "Unassigned category"}</td>
                  <td>{computeAge(r.students?.birthday ?? null) ?? "—"}</td>
                  <td>{fmtWeight(r.students?.weight_kg ?? null)}</td>
                  <td>{fmtHeight(r.students?.height_cm ?? null)}</td>
                  <td className="whitespace-nowrap text-right">
                    {canEdit && (
                      <form action={approveRegistration} className="inline">
                        <input type="hidden" name="registrationId" value={r.id} />
                        <input type="hidden" name="eventId" value={event.id} />
                        <button type="submit" className="mr-3 text-sm font-medium text-green-700 hover:underline">Approve</button>
                      </form>
                    )}
                    {canRemove(r.clubs?.id ?? null) && (
                      <form action={unregisterStudent} className="inline">
                        <input type="hidden" name="registrationId" value={r.id} />
                        <input type="hidden" name="eventId" value={event.id} />
                        <button type="submit" className="text-sm font-medium text-red-600 hover:underline">Remove</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr><td colSpan={8} className="py-4 text-center text-gray-400">Nothing pending.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">Confirmed ({confirmed.length})</h2>
        <p className="mt-1 text-sm text-gray-500">Grouped by club. Each club can export its confirmed list as a CSV, including competition numbers.</p>
        <div className="mt-4 space-y-6">
          {clubGroups.map((group) => (
            <div key={group.clubName}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-800">{group.clubName} ({group.rows.length})</h3>
                <ClubExportButton
                  clubName={group.clubName}
                  rows={group.rows.map((r: any) => ({
                    competitionNumber: r.competition_number,
                    name: r.students?.full_name ?? "",
                    gender: r.students?.gender ?? null,
                    age: computeAge(r.students?.birthday ?? null),
                    weightKg: r.students?.weight_kg ?? null,
                    heightCm: r.students?.height_cm ?? null,
                    category: r.event_categories?.name ?? null,
                    nationality: r.students?.nationality ?? null,
                  }))}
                />
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr><th>No.</th><th>Student</th><th>Category</th><th>Age</th><th>Weight</th><th>Height</th><th></th></tr>
                  </thead>
                  <tbody>
                    {group.rows.map((r: any) => (
                      <tr key={r.id}>
                        <td className="font-medium text-gray-900">{r.competition_number ?? "—"}</td>
                        <td>{r.students?.full_name}</td>
                        <td>{r.event_categories?.name ?? "Unassigned category"}</td>
                        <td>{computeAge(r.students?.birthday ?? null) ?? "—"}</td>
                        <td>{fmtWeight(r.students?.weight_kg ?? null)}</td>
                        <td>{fmtHeight(r.students?.height_cm ?? null)}</td>
                        <td className="text-right">
                          {canRemove(r.clubs?.id ?? null) && (
                            <form action={unregisterStudent} className="inline">
                              <input type="hidden" name="registrationId" value={r.id} />
                              <input type="hidden" name="eventId" value={event.id} />
                              <button type="submit" className="text-sm font-medium text-red-600 hover:underline">Remove</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {clubGroups.length === 0 && <p className="py-4 text-center text-gray-400">No confirmed competitors yet.</p>}
        </div>
      </div>
    </div>
  );
}
