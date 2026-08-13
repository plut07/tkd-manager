import { supabaseAdmin } from "@/lib/supabaseAdmin";
import BeltBadge from "@/components/BeltBadge";
import { computeAge } from "@/lib/eligibility";
import { formatEventDateTime } from "@/lib/eventStatus";
import { missingRequired, examTotal, type ExamEventKey } from "@/lib/gradingExam";
import { publishResults, unpublishResults } from "./examActions";

/**
 * The published outcome of a grading.
 *
 * Results stay hidden until somebody publishes them, so a half-marked exam is
 * never mistaken for a final list. Before that point the people running the
 * event see a preview of what publishing would show.
 */
export default async function ResultTab({
  eventId,
  publishedAt,
  canPublish,
  canPreview,
}: {
  eventId: string;
  publishedAt: string | null;
  canPublish: boolean;
  canPreview: boolean;
}) {
  const supabase = supabaseAdmin();

  const { data: regs } = await supabase
    .from("event_registrations")
    .select("id, competition_number, event_categories(name), students(full_name, gender, birthday, gup, dan)")
    .eq("event_id", eventId);

  const ids = (regs ?? []).map((r: any) => r.id);
  let scores: any[] = [];
  if (ids.length > 0) {
    const { data } = await supabase.from("grading_exam_scores").select("*").in("registration_id", ids);
    scores = data ?? [];
  }
  const scoreByReg = new Map(scores.map((s: any) => [s.registration_id, s]));

  // Only candidates who were actually examined belong on a result list.
  const results = (regs ?? [])
    .map((r: any) => ({ reg: r, score: scoreByReg.get(r.id) }))
    .filter((x) => x.score && missingRequired(x.score).length === 0)
    .sort((a, b) => (a.reg.students?.full_name ?? "").localeCompare(b.reg.students?.full_name ?? ""));

  const published = Boolean(publishedAt);
  const passCount = results.filter((x) => x.score.passed === true).length;

  if (!published && !canPreview) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">Results</h2>
        <p className="mt-2 text-sm text-gray-500">The results for this grading haven&apos;t been published yet.</p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Results</h2>
          <p className="mt-1 text-sm text-gray-500">
            {published
              ? `Published ${formatEventDateTime(publishedAt)} · ${passCount} of ${results.length} passed.`
              : `Not published yet — this is a preview of what will be shown. ${results.length} candidate${results.length === 1 ? "" : "s"} fully marked.`}
          </p>
        </div>
        {canPublish && (
          <form action={published ? unpublishResults : publishResults}>
            <input type="hidden" name="eventId" value={eventId} />
            <button type="submit" className={published ? "btn-secondary" : "btn-primary"}>
              {published ? "Unpublish results" : "Publish results"}
            </button>
          </form>
        )}
      </div>

      {!published && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Only people who can edit this event can see this list. Publishing makes it visible to everyone with access to
          the event.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>No.</th>
              <th>Name</th>
              <th className="hidden md:table-cell">Gender</th>
              <th className="hidden md:table-cell">Age</th>
              <th>Current Belt</th>
              <th className="hidden lg:table-cell">Graded for</th>
              <th className="hidden lg:table-cell">Total</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map(({ reg, score }) => (
              <tr key={reg.id}>
                <td>{reg.competition_number ?? "—"}</td>
                <td className="font-medium text-gray-900">{reg.students?.full_name}</td>
                <td className="hidden capitalize md:table-cell">{reg.students?.gender ?? "—"}</td>
                <td className="hidden md:table-cell">{computeAge(reg.students?.birthday ?? null) ?? "—"}</td>
                <td><BeltBadge gup={reg.students?.gup ?? null} dan={reg.students?.dan ?? null} /></td>
                <td className="hidden lg:table-cell">{reg.event_categories?.name ?? "—"}</td>
                <td className="hidden lg:table-cell">{examTotal(score as Partial<Record<ExamEventKey, number | null>>)}</td>
                <td>
                  <span className={`badge ${score.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {score.passed ? "PASS" : "Failed"}
                  </span>
                </td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-gray-400">
                  Nobody has been fully marked yet. Score every mandatory event on the Exam page first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
