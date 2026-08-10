import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission, clubScope } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import RegisterStudentForm from "../../RegisterStudentForm";
import ClubExportButton from "@/components/ClubExportButton";
import { EVENT_TYPE_LABELS } from "@/lib/eventCategories";
import { type CategoryCriteria, computeAge } from "@/lib/eligibility";
import { registerStudent, unregisterStudent, approveRegistration } from "../../actions";
import { isRegistrationOpen, canOverrideLocks } from "@/lib/eventStatus";

export default async function EventRegisterPage({ params }: { params: { id: string } }) {
  const session = await requirePermission(PERMISSIONS.EVENT_VIEW);
  const supabase = supabaseAdmin();
  const scope = clubScope(session);

  const { data: event } = await supabase.from("events").select("*").eq("id", params.id).maybeSingle();
  if (!event) notFound();

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

  let studentOptions: {
    id: string;
    full_name: string;
    club_id: string;
    clubs: { name: string; country: string | null } | null;
    gup: number | null;
    dan: number | null;
    gender: string | null;
    birthday: string | null;
    weight_kg: number | null;
    nationality: string | null;
  }[] = [];
  const studentSelect =
    "id, full_name, club_id, clubs(name, country), gup, dan, gender, birthday, weight_kg, nationality";
  if (scope) {
    const { data } = await supabase
      .from("students")
      .select(studentSelect)
      .eq("club_id", scope)
      .eq("active", true)
      .order("full_name");
    studentOptions = (data as any) ?? [];
  } else {
    const { data } = await supabase.from("students").select(studentSelect).eq("active", true).order("full_name");
    studentOptions = (data as any) ?? [];
  }

  const canEditRaw = hasPermission(session, PERMISSIONS.EVENT_EDIT);
  // Finished events are read-only unless you are a Super Admin.
  // Entries close at the registration deadline, not when the event runs.
  const locked = !isRegistrationOpen(event) && !canOverrideLocks({ sub: session.sub, role: session.role }, event);
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

  function fmtWeight(kg: number | null) {
    return kg ? `${kg} kg` : "—";
  }
  function fmtHeight(cm: number | null) {
    return cm ? `${cm} cm` : "—";
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Register for {event.name}</h1>
            <p className="mt-1 text-sm text-gray-500">{EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}</p>
          </div>
          <Link href={`/events/${event.id}`} className="btn-secondary">
            Back to event
          </Link>
        </div>

        {locked ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Registration has closed for this event. Entries are shown for reference and can no longer be changed.</p>
        ) : studentOptions.length > 0 ? (
          <RegisterStudentForm
            action={registerStudent}
            eventId={event.id}
            students={studentOptions}
            categories={(categories ?? []) as (CategoryCriteria & { id: string; name: string })[]}
            showClub={!scope}
            useCategories={event.event_type === "competition"}
            allowedCountries={event.allowed_countries ?? []}
          />
        ) : (
          <p className="mt-4 text-sm text-gray-500">No active students available to register.</p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          New registrations are placed in the pending list below until an organizer approves them. Approved
          competitors are automatically assigned a competition number for this event.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">Pending approval ({pending.length})</h2>
        <p className="mt-1 text-sm text-gray-500">Competitors waiting for an organizer to confirm their entry.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>No.</th>
                <th>Student</th>
                <th>Club</th>
                <th>Category</th>
                <th>Age</th>
                <th>Weight</th>
                <th>Height</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.competition_number ?? "—"}</td>
                  <td>
                    {r.students?.full_name}
                  </td>
                  <td>{r.clubs?.name ?? "—"}</td>
                  <td>{r.event_categories?.name ?? "Unassigned category"}</td>
                  <td>{computeAge(r.students?.birthday ?? null) ?? "—"}</td>
                  <td>{fmtWeight(r.students?.weight_kg ?? null)}</td>
                  <td>{fmtHeight(r.students?.height_cm ?? null)}</td>
                  <td className="text-right whitespace-nowrap">
                    {canEdit && (
                      <form action={approveRegistration} className="inline">
                        <input type="hidden" name="registrationId" value={r.id} />
                        <input type="hidden" name="eventId" value={event.id} />
                        <button type="submit" className="mr-3 text-sm font-medium text-green-700 hover:underline">
                          Approve
                        </button>
                      </form>
                    )}
                    {canRemove(r.clubs?.id ?? null) && (
                      <form action={unregisterStudent} className="inline">
                        <input type="hidden" name="registrationId" value={r.id} />
                        <input type="hidden" name="eventId" value={event.id} />
                        <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
                          Remove
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-gray-400">
                    Nothing pending.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">Confirmed ({confirmed.length})</h2>
        <p className="mt-1 text-sm text-gray-500">
          Grouped by club. Each club can export its confirmed list as a CSV, including competition numbers.
        </p>
        <div className="mt-4 space-y-6">
          {clubGroups.map((group) => (
            <div key={group.clubName}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-800">
                  {group.clubName} ({group.rows.length})
                </h3>
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
                    <tr>
                      <th>No.</th>
                      <th>Student</th>
                      <th>Category</th>
                      <th>Age</th>
                      <th>Weight</th>
                      <th>Height</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((r: any) => (
                      <tr key={r.id}>
                        <td className="font-medium text-gray-900">{r.competition_number ?? "—"}</td>
                        <td>
                          {r.students?.full_name}
                        </td>
                        <td>{r.event_categories?.name ?? "Unassigned category"}</td>
                        <td>{computeAge(r.students?.birthday ?? null) ?? "—"}</td>
                        <td>{fmtWeight(r.students?.weight_kg ?? null)}</td>
                        <td>{fmtHeight(r.students?.height_cm ?? null)}</td>
                        <td className="text-right">
                          {canRemove(r.clubs?.id ?? null) && (
                            <form action={unregisterStudent} className="inline">
                              <input type="hidden" name="registrationId" value={r.id} />
                              <input type="hidden" name="eventId" value={event.id} />
                              <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
                                Remove
                              </button>
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
