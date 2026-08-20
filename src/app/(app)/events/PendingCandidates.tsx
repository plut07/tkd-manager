import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { gradeShort } from "@/lib/belts";
import { formatDob, computeAge } from "@/lib/eligibility";
import CreateClubInline from "@/components/CreateClubInline";
import { approveCandidate, rejectCandidate } from "./gradingActions";
import { approveRegistration, unregisterStudent } from "./actions";

/**
 * Everything waiting on a decision, in one list.
 *
 * Two things can be pending and they used to sit in separate tables: somebody
 * who registered themselves and isn't a student yet, and an entry a club added
 * that hasn't been confirmed. From the organiser's side that distinction is
 * noise — both are "people I need to approve" — so they're shown together and
 * labelled by where they came from.
 */
export default async function PendingCandidates({
  eventId,
  isSuperAdmin,
  canEdit,
}: {
  eventId: string;
  isSuperAdmin: boolean;
  canEdit: boolean;
}) {
  const supabase = supabaseAdmin();

  const { data: candidates } = await supabase
    .from("grading_candidates")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "pending")
    .order("created_at");

  const { data: entries } = await supabase
    .from("event_registrations")
    .select("id, registered_at, clubs(id, name), students(full_name, birthday, gender, gup, dan, national_id), event_categories(name)")
    .eq("event_id", eventId)
    .eq("status", "pending")
    .order("registered_at");

  const { data: clubs } = await supabase.from("clubs").select("id, name").eq("active", true).order("name");

  const waiting = (candidates ?? []).length + (entries ?? []).length;

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-gray-900">Pending approval ({waiting})</h2>
      <p className="mt-1 text-sm text-gray-500">
        Everyone waiting to be let into this event. Approving somebody who registered themselves creates their student
        record and their entry in one step, and brings their signed form across with them — they are never asked to sign
        again.
      </p>

      <div className="mt-4 space-y-3">
        {(candidates ?? []).map((c: any) => {
          const needsClub = !c.matched_club_id;
          return (
            <div key={c.id} className="rounded-md border border-gray-200 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-900">
                    {c.full_name}
                    <span className="ml-2 badge bg-gray-100 text-gray-500">Registered themselves</span>
                    {c.signature_png && <span className="ml-2 badge bg-green-100 text-green-700">Signed</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {[c.nationality, c.national_id, gradeShort(c.gup, c.dan)].filter((v: any) => v && v !== "—").join(" · ")}
                  </div>
                  <div className="text-xs text-gray-400">
                    Club on form: {c.club_name_raw ?? "—"}
                    {c.birthday ? ` · born ${formatDob(c.birthday)}` : ""}
                    {c.gender ? ` · ${c.gender}` : ""}
                    {c.email ? ` · ${c.email}` : ""}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </div>
                  {c.review_note && (
                    <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                      {c.review_note}
                    </p>
                  )}
                  {c.public_token && (
                    <a
                      href={`/api/public/grading-form?token=${c.public_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-brand-700 hover:underline"
                    >
                      View their signed form (PDF)
                    </a>
                  )}
                </div>

                {isSuperAdmin ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={approveCandidate} className="flex items-center gap-2">
                      <input type="hidden" name="candidateId" value={c.id} />
                      <input type="hidden" name="eventId" value={eventId} />
                      <select name="clubId" className="input !w-48" defaultValue={c.matched_club_id ?? ""} required>
                        <option value="" disabled>Choose a club</option>
                        {(clubs ?? []).map((club: any) => (<option key={club.id} value={club.id}>{club.name}</option>))}
                      </select>
                      <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">Approve</button>
                    </form>
                    <form action={rejectCandidate}>
                      <input type="hidden" name="candidateId" value={c.id} />
                      <input type="hidden" name="eventId" value={eventId} />
                      <button type="submit" className="text-sm font-medium text-red-600 hover:underline">Reject</button>
                    </form>
                  </div>
                ) : (
                  <span className="badge bg-gray-100 text-gray-500">Pending Super Admin review</span>
                )}
              </div>

              {/* The club problem is stated under the person it belongs to, so
                  it's obvious which entry is being held up. */}
              {isSuperAdmin && needsClub && (
                <CreateClubInline candidateId={c.id} eventId={eventId} suggestedName={c.club_name_raw ?? ""} />
              )}
            </div>
          );
        })}

        {(entries ?? []).map((r: any) => (
          <div key={r.id} className="rounded-md border border-gray-200 p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-gray-900">
                  {r.students?.full_name}
                  <span className="ml-2 badge bg-gray-100 text-gray-500">Entered by a club</span>
                </div>
                <div className="text-xs text-gray-500">
                  {[r.clubs?.name, r.students?.national_id, gradeShort(r.students?.gup, r.students?.dan)]
                    .filter((v: any) => v && v !== "—")
                    .join(" · ")}
                </div>
                <div className="text-xs text-gray-400">
                  {r.event_categories?.name ?? "No category yet"}
                  {r.students?.birthday ? ` · born ${formatDob(r.students.birthday)}` : ""}
                  {computeAge(r.students?.birthday ?? null) != null ? ` · age ${computeAge(r.students?.birthday ?? null)}` : ""}
                  {r.students?.gender ? ` · ${r.students.gender}` : ""}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {canEdit && (
                  <form action={approveRegistration}>
                    <input type="hidden" name="registrationId" value={r.id} />
                    <input type="hidden" name="eventId" value={eventId} />
                    <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">Approve</button>
                  </form>
                )}
                {canEdit && (
                  <form action={unregisterStudent}>
                    <input type="hidden" name="registrationId" value={r.id} />
                    <input type="hidden" name="eventId" value={eventId} />
                    <button type="submit" className="text-sm font-medium text-red-600 hover:underline">Remove</button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ))}

        {waiting === 0 && <p className="py-4 text-center text-gray-400">Nobody is waiting on approval.</p>}
      </div>
    </div>
  );
}
