import CompetitionResults from "@/components/CompetitionResults";
import { loadEventResults } from "./resultsData";
import { publishCompetitionResults, unpublishCompetitionResults } from "./resultsActions";

/**
 * The organiser's view of the results, and the switch that makes them public.
 *
 * They see the whole thing either way, including divisions still being fought —
 * that is what tells them how much of the day is left. What publishing changes
 * is only whether the outside world can see it.
 */
export default async function CompetitionResultsTab({
  eventId,
  publishedAt,
  canPublish,
}: {
  eventId: string;
  publishedAt: string | null;
  canPublish: boolean;
}) {
  const results = await loadEventResults(eventId);
  const published = Boolean(publishedAt);
  const complete = results.totalCount > 0 && results.decidedCount === results.totalCount;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {published ? "Results are published" : "Results are not published yet"}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {published
                ? `Anyone can see these on the event's public page. Published ${new Date(publishedAt as string).toLocaleString()}.`
                : "Only people signed in can see this page. Publish when the day is done and the podiums are right."}
            </p>
            {!published && !complete && results.totalCount > 0 && (
              <p className="mt-1 text-xs text-amber-700">
                {results.totalCount - results.decidedCount} division
                {results.totalCount - results.decidedCount === 1 ? " is" : "s are"} still undecided. You can publish
                anyway — the public page shows only the divisions that have finished.
              </p>
            )}
          </div>

          {canPublish && (
            <form action={published ? unpublishCompetitionResults : publishCompetitionResults}>
              <input type="hidden" name="eventId" value={eventId} />
              <button type="submit" className={published ? "btn-secondary" : "btn-primary"}>
                {published ? "Unpublish" : "Publish results"}
              </button>
            </form>
          )}
        </div>
      </div>

      <CompetitionResults results={results} showIncomplete />
    </div>
  );
}
