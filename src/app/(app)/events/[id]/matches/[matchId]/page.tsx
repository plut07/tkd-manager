import Link from "next/link";
import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadMatchRecord } from "../../../scoreboardActions";
import { judgeScore, judgeVerdict, penaltyTally, WARNINGS_PER_POINT, type Side } from "@/lib/scoreboard";

export const dynamic = "force-dynamic";

/**
 * A finished bout, exactly as it was scored.
 *
 * Read-only and reachable from the draw. Every press a judge made is still on
 * file, so a result questioned afterwards can be gone through mark by mark
 * rather than argued from memory.
 */
export default async function MatchRecordPage({ params }: { params: { id: string; matchId: string } }) {
  await requirePermission(PERMISSIONS.EVENT_VIEW);

  const record = await loadMatchRecord({ matchId: params.matchId });

  const { data: match } = await supabaseAdmin()
    .from("event_matches")
    .select("id, category_id, round, slot, competitor1_points, competitor2_points")
    .eq("id", params.matchId)
    .maybeSingle();
  const backHref = `/events/${params.id}?tab=draws${match?.category_id ? `&category=${match.category_id}` : ""}`;

  if (!record) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-gray-500">
          There is no scoreboard record for this bout. Results typed straight into the draw don&apos;t have one — only
          bouts scored on a ring do.
        </p>
        <Link href={backHref} className="btn-secondary mt-4 inline-block">Back to the draw</Link>
      </div>
    );
  }

  const judges = Array.from({ length: record.judgeCount }, (_, i) => i + 1);
  const rounds = Array.from({ length: Math.max(1, record.rounds) }, (_, i) => i + 1);
  const live = record.entries.filter((e) => !e.voided);
  const takenBack = record.entries.length - live.length;

  const sides: { side: Side; name: string | null; number: string | null; votes: number }[] = [
    { side: "red", name: record.redName, number: record.redNumber, votes: record.redVotes },
    { side: "blue", name: record.blueName, number: record.blueNumber, votes: record.blueVotes },
  ];

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Match record</h1>
            <p className="mt-1 text-sm text-gray-500">
              {record.mode === "flag" ? "Flags" : record.mode === "pattern" ? "Pattern" : "Sparring"}
              {record.patternName ? ` · ${record.patternName}` : ""} · {record.judgeCount} judges
              {record.mode === "pattern" ? ` · starting at ${record.patternBase}` : ""} · confirmed{" "}
              {new Date(record.confirmedAt).toLocaleString()}
            </p>
          </div>
          <Link href={backHref} className="btn-secondary">Back to the draw</Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          {sides.map((s) => {
            const won = record.winnerRegistrationId != null && s.votes > (s.side === "red" ? record.blueVotes : record.redVotes);
            return (
              <div key={s.side} className={`rounded-md p-4 text-center ${s.side === "red" ? "bg-red-50" : "bg-blue-50"} ${won ? "ring-2 ring-yellow-400" : ""}`}>
                <p className={`text-xs font-bold uppercase ${s.side === "red" ? "text-red-700" : "text-blue-700"}`}>{s.side}</p>
                <p className="truncate text-sm text-gray-700">{s.number ? `#${s.number} ` : ""}{s.name ?? "—"}</p>
                <p className="text-4xl font-bold text-gray-900">{s.votes}</p>
                <p className="text-xs text-gray-500">judges of {record.judgeCount}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-900">Each judge&apos;s mark</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Judge</th><th className="text-center">Red</th><th className="text-center">Blue</th><th>Favoured</th></tr>
            </thead>
            <tbody>
              {judges.map((judge) => {
                const verdict = judgeVerdict(record.entries, judge, record.mode, record.patternBase);
                return (
                  <tr key={judge}>
                    <td className="font-medium text-gray-900">Judge {judge}</td>
                    <td className="text-center">{judgeScore(record.entries, judge, "red", record.mode, record.patternBase)}</td>
                    <td className="text-center">{judgeScore(record.entries, judge, "blue", record.mode, record.patternBase)}</td>
                    <td>
                      {verdict ? (
                        <span className={`badge ${verdict === "red" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>{verdict.toUpperCase()}</span>
                      ) : (
                        <span className="text-gray-400">tied</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-900">Warnings and deductions</h2>
        <div className="mt-3 grid grid-cols-2 gap-4">
          {sides.map((s) => {
            const p = penaltyTally(record.entries, s.side);
            return (
              <div key={s.side} className={`rounded-md p-3 text-center ${s.side === "red" ? "bg-red-50" : "bg-blue-50"}`}>
                <p className="text-xs font-bold uppercase text-gray-600">{s.side}</p>
                <p className="mt-1 text-sm text-gray-700">
                  {p.warnings} warning{p.warnings === 1 ? "" : "s"} · {p.deductions} deduction{p.deductions === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-gray-500">
                  {p.points > 0 ? `−${p.points} point${p.points === 1 ? "" : "s"} off every judge` : "no points lost"}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gray-400">Every {WARNINGS_PER_POINT} warnings costs a point.</p>
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-900">Every press, in order</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          {live.length} counted{takenBack > 0 ? `, ${takenBack} taken back` : ""}. Presses a judge undid are kept and shown struck
          through — they are part of the record too.
        </p>
        <div className="mt-3 space-y-4">
          {rounds.map((round) => {
            const inRound = record.entries.filter((e) => (e.round ?? 1) === round);
            return (
              <div key={round}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Round {round}</h3>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {inRound.map((e, i) => (
                    <span
                      key={i}
                      className={`rounded px-2 py-0.5 text-xs ${
                        e.voided ? "bg-gray-100 text-gray-400 line-through" : e.side === "red" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {e.judge_slot === 0 ? "REF" : `J${e.judge_slot}`}{" "}
                      {e.kind === "flag" ? "flag" : e.kind === "warning" ? "warning" : e.kind === "penalty" ? "deduction" : e.value > 0 ? `+${e.value}` : e.value}
                    </span>
                  ))}
                  {inRound.length === 0 && <span className="text-xs text-gray-400">Nothing recorded.</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
