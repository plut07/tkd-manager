import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createGradingForm, syncGradingResponses, approveCandidate, rejectCandidate, bulkApproveBatch } from "./gradingActions";
export default async function GradingTab({ eventId, canEdit, isSuperAdmin }: { eventId: string; canEdit: boolean; isSuperAdmin: boolean }) {
  const supabase = supabaseAdmin();
  const { data: gform } = await supabase.from("grading_forms").select("*").eq("event_id", eventId).maybeSingle();
  const { data: batches } = await supabase.from("grading_import_batches").select("*").eq("event_id", eventId).order("imported_at", { ascending: false });
  const { data: candidates } = await supabase.from("grading_candidates").select("*").eq("event_id", eventId).eq("status", "pending").order("created_at");
  const { data: clubs } = await supabase.from("clubs").select("id, name").eq("active", true).order("name");
  const candidatesByBatch = new Map<string, any[]>();
  (candidates ?? []).forEach((c) => { if (!candidatesByBatch.has(c.batch_id)) candidatesByBatch.set(c.batch_id, []); candidatesByBatch.get(c.batch_id)!.push(c); });
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">Grading registration form</h2>
        <p className="mt-1 text-sm text-gray-500">Students register through a Tally form. New submissions arrive here automatically via webhook — use "Sync now" only to backfill older responses.</p>
        {!gform ? (
          canEdit ? (
            <form action={createGradingForm} className="mt-4">
              <input type="hidden" name="eventId" value={eventId} />
              <button type="submit" className="btn-primary">Create Tally form</button>
            </form>
          ) : (<p className="mt-4 text-sm text-gray-400">No registration form has been created for this event yet.</p>)
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <a href={gform.form_url} target="_blank" rel="noopener noreferrer" className="btn-secondary">Open registration form</a>
              <a href={gform.edit_url} target="_blank" rel="noopener noreferrer" className="btn-secondary">Edit form in Tally</a>
              {canEdit && (
                <form action={syncGradingResponses}>
                  <input type="hidden" name="eventId" value={eventId} />
                  <button type="submit" className="btn-secondary">Sync now (backfill)</button>
                </form>
              )}
            </div>
            <p className="break-all text-xs text-gray-400">{gform.form_url}</p>
          </div>
        )}
      </div>
      {(batches ?? []).length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900">Import history</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Synced</th><th>Rows</th><th>Matched existing</th><th>New (pending approval)</th>{isSuperAdmin && <th></th>}</tr></thead>
              <tbody>
                {(batches ?? []).map((b) => {
                  const pendingInBatch = (candidatesByBatch.get(b.id) ?? []).filter((c) => c.matched_club_id);
                  return (
                    <tr key={b.id}>
                      <td>{new Date(b.imported_at).toLocaleString()}</td>
                      <td>{b.row_count}</td>
                      <td>{b.matched_count}</td>
                      <td>{b.new_count}</td>
                      {isSuperAdmin && (
                        <td className="text-right">
                          {pendingInBatch.length > 0 && (
                            <form action={bulkApproveBatch}>
                              <input type="hidden" name="batchId" value={b.id} />
                              <input type="hidden" name="eventId" value={eventId} />
                              <button type="submit" className="text-sm font-medium text-green-700 hover:underline">Approve {pendingInBatch.length} matched</button>
                            </form>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">New registrants awaiting approval ({(candidates ?? []).length})</h2>
        <p className="mt-1 text-sm text-gray-500">These people weren't found in the system by national ID / passport number. A Super Admin must pick their club and approve before a student profile is created.</p>
        <div className="mt-4 space-y-3">
          {(candidates ?? []).map((c) => (
            <div key={c.id} className="rounded-md border border-gray-200 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-gray-900">{c.first_name} {c.last_name}</div>
                  <div className="text-xs text-gray-500">{[c.nationality, c.national_id, c.gup ? `Gup ${c.gup}` : c.dan ? `Dan ${c.dan}` : null].filter(Boolean).join(" · ")}</div>
                  <div className="text-xs text-gray-400">Club on form: {c.club_name_raw ?? "—"}</div>
                </div>
                {isSuperAdmin ? (
                  <div className="flex items-center gap-2">
                    <form action={approveCandidate} className="flex items-center gap-2">
                      <input type="hidden" name="candidateId" value={c.id} />
                      <input type="hidden" name="eventId" value={eventId} />
                      <select name="clubId" className="input !w-48" defaultValue={c.matched_club_id ?? ""} required>
                        <option value="" disabled>Choose a club</option>
                        {(clubs ?? []).map((club) => (<option key={club.id} value={club.id}>{club.name}</option>))}
                      </select>
                      <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">Approve</button>
                    </form>
                    <form action={rejectCandidate}>
                      <input type="hidden" name="candidateId" value={c.id} />
                      <input type="hidden" name="eventId" value={eventId} />
                      <button type="submit" className="text-sm font-medium text-red-600 hover:underline">Reject</button>
                    </form>
                  </div>
                ) : (<span className="badge bg-gray-100 text-gray-500">Pending Super Admin review</span>)}
              </div>
            </div>
          ))}
          {(candidates ?? []).length === 0 && <p className="py-4 text-center text-gray-400">No new registrants waiting on approval.</p>}
        </div>
      </div>
    </div>
  );
}
