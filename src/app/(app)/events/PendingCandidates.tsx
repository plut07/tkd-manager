import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { gradeShort } from "@/lib/belts";
import { formatDob } from "@/lib/eligibility";
import { approveCandidate, rejectCandidate, generateClubForCandidate } from "./gradingActions";

/**
 * People who registered themselves and aren't students yet.
 *
 * Everything from the public grading form lands here, along with anything an
 * import couldn't match with confidence. Approving creates the student record
 * and their entry; rejecting discards the submission.
 */
export default async function PendingCandidates({
  eventId,
  isSuperAdmin,
}: {
  eventId: string;
  isSuperAdmin: boolean;
}) {
  const supabase = supabaseAdmin();
  const { data: candidates } = await supabase
    .from("grading_candidates")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "pending")
    .order("created_at");
  const { data: clubs } = await supabase.from("clubs").select("id, name").eq("active", true).order("name");

  const list = candidates ?? [];

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-gray-900">Awaiting approval ({list.length})</h2>
      <p className="mt-1 text-sm text-gray-500">
        Registrations from the public page, plus anything that needs a second look. This is the only approval — once you
        approve, the student record and their confirmed entry are both created, and their signature comes across with
        them. If their club isn&apos;t on file yet, create it from what they typed.
      </p>

      <div className="mt-4 space-y-3">
        {list.map((c: any) => (
          <div key={c.id} className="rounded-md border border-gray-200 p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-gray-900">
                  {c.full_name}
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
                    View their submitted form (PDF)
                  </a>
                )}
              </div>
              {isSuperAdmin ? (
                <div className="flex flex-wrap items-center gap-2">
                  {!c.matched_club_id && c.club_name_raw && (
                    <form action={generateClubForCandidate}>
                      <input type="hidden" name="candidateId" value={c.id} />
                      <input type="hidden" name="eventId" value={eventId} />
                      <button type="submit" className="btn-secondary !px-3 !py-1.5 text-xs" title={`Create "${c.club_name_raw}" as a club`}>
                        Generate club &ldquo;{c.club_name_raw}&rdquo;
                      </button>
                    </form>
                  )}
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
          </div>
        ))}
        {list.length === 0 && <p className="py-4 text-center text-gray-400">Nobody is waiting on approval.</p>}
      </div>
    </div>
  );
}
