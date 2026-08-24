import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ROUND_ORDER, ROUND_LABELS, placings } from "@/lib/bracket";

// These pages read live data but never touch cookies, so Next would otherwise
// prerender them at build time and keep serving that snapshot — edits and
// deletions wouldn't show until the next deploy. Force a fresh query per request.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RegInfo = { name: string; club: string | null; number: string | null };

export default async function PublicBracketPage({ params }: { params: { id: string; categoryId: string } }) {
  const supabase = supabaseAdmin();

  const { data: event } = await supabase.from("events").select("id, name").eq("id", params.id).maybeSingle();
  const { data: category } = await supabase.from("event_categories").select("id, name").eq("id", params.categoryId).maybeSingle();
  if (!event || !category) notFound();

  const { data: bracket } = await supabase
    .from("event_category_brackets")
    .select("status")
    .eq("event_category_id", category.id)
    .maybeSingle();
  if (bracket?.status !== "published") notFound();

  const { data: matches } = await supabase
    .from("event_matches")
    .select("*")
    .eq("category_id", category.id)
    .order("slot");

  const regIds = new Set<string>();
  (matches ?? []).forEach((m) => {
    if (m.competitor1_registration_id) regIds.add(m.competitor1_registration_id);
    if (m.competitor2_registration_id) regIds.add(m.competitor2_registration_id);
  });
  const regMap = new Map<string, RegInfo>();
  if (regIds.size > 0) {
    const { data: regs } = await supabase
      .from("event_registrations")
      .select("id, competition_number, students(full_name), clubs(name)")
      .in("id", Array.from(regIds));
    (regs ?? []).forEach((r: any) => {
      regMap.set(r.id, {
        name: r.students?.full_name ?? "",
        club: r.clubs?.name ?? null,
        number: r.competition_number != null ? String(r.competition_number) : null,
      });
    });
  }
  const nameOf = (id: string | null) => (id ? regMap.get(id) ?? null : null);

  const mainRounds = ROUND_ORDER.filter((r) => (matches ?? []).some((m) => m.round === r));
  const finalMatch = (matches ?? []).find((m) => m.round === "final") ?? null;
  const podium = placings((matches ?? []) as any);

  // Everyone in this category, whether or not the draw has reached them.
  // Coaches read the entry list to find their own people before they read the
  // chart, so it is published alongside it rather than left on the admin side.
  const { data: entries } = await supabase
    .from("event_registrations")
    .select("id, competition_number, students(full_name, gender), clubs(name)")
    .eq("category_id", category.id)
    .eq("status", "confirmed")
    .order("competition_number");

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
            <p className="mt-1 text-sm text-gray-500">{event.name} — Bracket</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/public/draw?categoryId=${category.id}&download=1`} className="btn-secondary">Download PDF</a>
            <Link href={`/public/events/${event.id}`} className="btn-secondary">Back to event</Link>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto p-6">
        <div className="flex gap-8">
          {mainRounds.map((round) => {
            const roundMatches = (matches ?? []).filter((m) => m.round === round).sort((a, b) => a.slot - b.slot);
            return (
              <div key={round} className="flex min-w-[220px] flex-col justify-around gap-6">
                <h3 className="text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {ROUND_LABELS[round]}
                </h3>
                {roundMatches.map((m) => (
                  <MatchBox key={m.id} match={m} nameOf={nameOf} />
                ))}
              </div>
            );
          })}
          {finalMatch && (
            <div className="flex min-w-[180px] flex-col justify-center gap-3">
              <h3 className="text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Winner!</h3>
              {/* Empty until it is decided, not "TBD" — see the admin chart. */}
              <div className="min-h-[3rem] rounded-md border-2 border-yellow-400 bg-yellow-50 p-3 text-center text-sm font-semibold text-gray-900">
                {finalMatch.winner_registration_id ? nameOf(finalMatch.winner_registration_id)?.name : ""}
              </div>
            </div>
          )}
        </div>

        {/* Both beaten semi-finalists take a bronze, so the podium is read off
            the draw rather than settled by an extra bout. */}
        <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
          <div className="w-full max-w-xs rounded-md border border-gray-200 bg-gray-50 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Placings</h3>
            <ul className="mt-2 space-y-1">
              {[
                { place: "1st", id: podium.first, style: "bg-yellow-100 text-yellow-900" },
                { place: "2nd", id: podium.second, style: "bg-gray-200 text-gray-800" },
                { place: "3rd", id: podium.thirds[0] ?? null, style: "bg-amber-100 text-amber-900" },
                { place: "3rd", id: podium.thirds[1] ?? null, style: "bg-amber-100 text-amber-900" },
              ].map((row, i) => {
                const who = nameOf(row.id);
                return (
                  <li key={`${row.place}-${i}`} className="flex items-center gap-2 text-sm">
                    <span className={`w-10 rounded px-1.5 py-0.5 text-center text-xs font-bold ${row.style}`}>{row.place}</span>
                    {who ? (
                      <span className="truncate font-medium text-gray-900">
                        {who.name}
                        {who.club && <span className="ml-1 text-xs font-normal text-gray-400">({who.club})</span>}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <EntryList entries={(entries ?? []) as any[]} />
    </div>
  );
}

/** Everyone entered in this category, in competition-number order. */
function EntryList({ entries }: { entries: any[] }) {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-gray-900">Competitors ({entries.length})</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr><th>No.</th><th>Name</th><th>Club</th></tr>
          </thead>
          <tbody>
            {entries.map((r: any) => (
              <tr key={r.id}>
                <td className="font-medium text-gray-900">{r.competition_number ?? "—"}</td>
                <td>{r.students?.full_name ?? "—"}</td>
                <td className="text-gray-600">{r.clubs?.name ?? "—"}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={3} className="py-4 text-center text-gray-400">No competitors confirmed yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatchBox({ match, nameOf }: { match: any; nameOf: (id: string | null) => RegInfo | null }) {
  const c1 = nameOf(match.competitor1_registration_id);
  const c2 = nameOf(match.competitor2_registration_id);
  const hasResult = match.winner_registration_id != null;

  // A bye is a blank line: somebody walked through, and naming an opponent
  // they never met reads as a real bout. Two blanks is a future match, not a
  // bye, so that still says TBD.
  const label = (info: RegInfo | null, present: boolean, opponentPresent: boolean) =>
    info ? info.name : present ? "—" : opponentPresent ? "" : "TBD";

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 text-sm shadow-sm">
      <MatchRow
        label={label(c1, !!match.competitor1_registration_id, !!match.competitor2_registration_id)}
        sub={c1?.club}
        won={hasResult && match.winner_registration_id === match.competitor1_registration_id}
        points={match.competitor1_points}
      />
      <div className="my-1 border-t border-dashed border-gray-200" />
      <MatchRow
        label={label(c2, !!match.competitor2_registration_id, !!match.competitor1_registration_id)}
        sub={c2?.club}
        won={hasResult && match.winner_registration_id === match.competitor2_registration_id}
        points={match.competitor2_points}
      />
    </div>
  );
}

function MatchRow({
  label,
  sub,
  won,
  points,
}: {
  label: string;
  sub?: string | null;
  won?: boolean;
  points?: number | null;
}) {
  if (!label) return <div className="h-6" />;

  return (
    <div className={`flex items-center justify-between rounded px-1.5 py-0.5 ${won ? "bg-green-100 font-bold text-green-900" : "text-gray-800"}`}>
      <span className="truncate">
        {label}
        {sub && <span className="ml-1 text-xs font-normal text-gray-400">({sub})</span>}
      </span>
      {points != null && <span className={`ml-2 text-xs ${won ? "font-bold text-green-900" : "text-gray-500"}`}>{points}</span>}
    </div>
  );
}
