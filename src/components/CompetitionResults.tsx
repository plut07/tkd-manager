import CountryFlag from "@/components/CountryFlag";
import { type EventResults, type Medallist, type CategoryResult } from "@/app/(app)/events/resultsData";
import { type MedalRow } from "@/lib/medals";

/**
 * The result of the whole competition, on one page.
 *
 * Two things people want at the end of a day and neither existed: the podium
 * for every division, and the medal table. Read-only by design — a result is
 * corrected where it was made, on the draw or the score sheet, so that there is
 * one place to change it and no way for the two to disagree.
 */
export default function CompetitionResults({
  results,
  showIncomplete = true,
}: {
  results: EventResults;
  /** The public page hides divisions still being fought; the organiser's shows them. */
  showIncomplete?: boolean;
}) {
  const shown = showIncomplete ? results.categories : results.categories.filter((c) => c.decided);

  if (results.totalCount === 0) {
    return <div className="card p-8 text-center text-gray-500">No categories on this event yet.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Results</h2>
          <p className="text-sm text-gray-500">
            {results.decidedCount} of {results.totalCount} division
            {results.totalCount === 1 ? "" : "s"} decided
          </p>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Read off the draws and the score sheets. To correct a result, correct the bout or the attempt it came from and
          this follows.
        </p>
      </div>

      {results.byClub.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <MedalTable title="Medal table — by club" rows={results.byClub} />
          {results.byCountry.length > 0 && (
            <MedalTable title="Medal table — by country" rows={results.byCountry} flags />
          )}
        </div>
      )}

      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-900">Divisions</h3>
        <div className="mt-3 space-y-3">
          {shown.map((category) => (
            <CategoryPodium key={category.categoryId} category={category} />
          ))}
          {shown.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">Nothing has been decided yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MedalTable({ title, rows, flags = false }: { title: string; rows: MedalRow[]; flags?: boolean }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="table-base min-w-full">
          <thead>
            <tr>
              <th className="w-10 text-center">#</th>
              <th>{flags ? "Country" : "Club"}</th>
              {/* Written out rather than left as three medal emoji, which are
                  near-indistinguishable at this size and read as nothing at
                  all to a screen reader. */}
              <th className="text-center">Gold</th>
              <th className="text-center">Silver</th>
              <th className="text-center">Bronze</th>
              <th className="text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="text-center text-sm text-gray-500">
                  {row.rank}
                  {row.tied ? "=" : ""}
                </td>
                <td className="font-medium text-gray-900">
                  {flags ? <CountryFlag country={row.name} /> : row.name}
                </td>
                <td className="text-center tabular-nums">{row.gold || "—"}</td>
                <td className="text-center tabular-nums">{row.silver || "—"}</td>
                <td className="text-center tabular-nums">{row.bronze || "—"}</td>
                <td className="text-center font-semibold tabular-nums">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Explained rather than left as a convention people are assumed to know. */}
      <p className="mt-2 text-xs text-gray-400">
        Ordered by golds first, then silvers, then bronzes — one gold outranks any number of silvers.
      </p>
    </div>
  );
}

function CategoryPodium({ category }: { category: CategoryResult }) {
  return (
    <div className="rounded-md border border-gray-200 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-medium text-gray-900">{category.name}</h4>
        {!category.decided && (
          <span className="badge bg-gray-100 text-gray-500">
            {category.measured ? "Not yet scored" : "Still being fought"}
          </span>
        )}
      </div>

      {category.decided ? (
        <ol className="mt-2 space-y-1">
          <Place rank="1st" tone="bg-amber-100 text-amber-800" who={category.first} />
          <Place rank="2nd" tone="bg-gray-200 text-gray-700" who={category.second} />
          {category.thirds.map((third) => (
            <Place key={third.registrationId} rank="3rd" tone="bg-orange-100 text-orange-800" who={third} />
          ))}
        </ol>
      ) : (
        <p className="mt-1 text-sm text-gray-400">No result yet.</p>
      )}
    </div>
  );
}

function Place({ rank, tone, who }: { rank: string; tone: string; who: Medallist | null }) {
  if (!who) return null;
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <span className={`badge ${tone} w-10 justify-center`}>{rank}</span>
      <span className="font-medium text-gray-900">
        {who.competitionNumber ? `#${who.competitionNumber} ` : ""}
        {who.name || "—"}
      </span>
      {who.clubName && <span className="text-gray-500">{who.clubName}</span>}
      {who.score !== null && <span className="text-xs text-gray-400">({who.score})</span>}
    </li>
  );
}
