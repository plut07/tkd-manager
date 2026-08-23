import { requirePermission, hasPermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import ClubExportButton from "@/components/ClubExportButton";
import { computeAge } from "@/lib/eligibility";
import { unregisterStudent } from "./actions";
import { isRegistrationOpen, canOverrideLocks } from "@/lib/eventStatus";
import PendingCandidates from "./PendingCandidates";

/**
 * Approving people, and the list of everyone who is in.
 *
 * Adding an entry used to sit at the top of this panel. It moved to the
 * Registration tab, where a coach starts, so this one is now purely about the
 * decision: who is waiting, and who has been let in.
 */
export default async function RegistrationPanel({ eventId }: { eventId: string }) {
  const session = await requirePermission(PERMISSIONS.EVENT_VIEW);
  const supabase = supabaseAdmin();

  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  if (!event) return <div className="card p-6 text-sm text-gray-500">Event not found.</div>;

  const { data: registrations } = await supabase
    .from("event_registrations")
    .select(
      "id, status, registered_at, competition_number, clubs(id, name), students(id, full_name, gender, weight_kg, height_cm, birthday, nationality), event_categories(id, name)"
    )
    .eq("event_id", event.id)
    .order("registered_at");

  const canEditRaw = hasPermission(session, PERMISSIONS.EVENT_EDIT);
  // Entries close at the registration deadline, not when the event runs.
  const locked = !isRegistrationOpen(event) && !canOverrideLocks({ sub: session.sub, role: session.role }, event as any);
  const canEdit = canEditRaw && !locked;
  const canManageAll = session.role === "super_admin" || session.role === "event_manager";

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
      <PendingCandidates eventId={event.id} isSuperAdmin={session.role === "super_admin"} canEdit={canEdit} />

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
