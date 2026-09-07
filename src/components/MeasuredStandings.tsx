import { standings, techniquesFor, RESULT_UNIT, bestAt } from "@/lib/measured";
import { type MeasuredCategory } from "@/app/(app)/events/measuredActions";

/**
 * The order of finish in a measured division, as anybody may read it.
 *
 * Read-only and derived, like everything else about a result here: the totals
 * come from the attempts every time rather than being stored, so a corrected
 * number moves the table with it.
 *
 * Shared between the organiser's sheet and the public page. The public one
 * shows exactly this and no attempt boxes -- watching the standings is the
 * point; watching an official type is not.
 */
export default function MeasuredStandings({ data }: { data: MeasuredCategory }) {
  const unit = RESULT_UNIT[data.kind];
  const all = techniquesFor(data.kind);
  const named = (key: string) => all.find((t) => t.key === key);
  const byId = new Map(data.entrants.map((e) => [e.registrationId, e]));

  const table = standings(
    data.attempts,
    data.entrants.map((e) => e.registrationId),
    data.techniques,
  ).filter((row) => row.total > 0);

  if (table.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
        Nobody has been through yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table-base min-w-full">
        <thead>
          <tr>
            <th className="w-12 text-center">#</th>
            <th>Competitor</th>
            {data.techniques.map((key) => (
              <th key={key} className="text-center">
                <span className="block">{named(key)?.name ?? key}</span>
                <span className="block text-[10px] font-normal text-gray-400">{named(key)?.english}</span>
              </th>
            ))}
            <th className="text-center">Total</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row) => {
            const who = byId.get(row.registrationId);
            return (
              <tr key={row.registrationId}>
                <td className="text-center">
                  <span
                    className={`badge ${
                      row.place === 1
                        ? "bg-amber-100 text-amber-800"
                        : row.place === 2
                          ? "bg-gray-200 text-gray-700"
                          : row.place === 3
                            ? "bg-orange-100 text-orange-800"
                            : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {row.place}
                    {row.tied ? "=" : ""}
                  </span>
                </td>
                <td>
                  <span className="font-medium text-gray-900">
                    {who?.competitionNumber ? `#${who.competitionNumber} ` : ""}
                    {who?.name || "—"}
                  </span>
                  {who?.clubName && <span className="block text-xs text-gray-400">{who.clubName}</span>}
                </td>
                {data.techniques.map((key) => (
                  <td key={key} className="text-center tabular-nums text-gray-700">
                    {bestAt(data.attempts, row.registrationId, key) || "—"}
                  </td>
                ))}
                <td className="text-center text-base font-bold text-gray-900">{row.total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-gray-400">
        Best of each competitor&apos;s attempts at each technique, in {unit.short}, added together. A tie on the total
        goes to whoever needed fewer attempts; <strong>=</strong> means even that could not separate them.
      </p>
    </div>
  );
}
