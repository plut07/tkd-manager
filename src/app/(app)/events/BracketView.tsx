import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ROUND_ORDER, ROUND_LABELS, placings } from "@/lib/bracket";
import { competitorName } from "@/lib/competitors";
import {
  generateBracket,
  submitMatchResult,
  clearMatchResult,
  sendMatchToRing,
  swapBracketSlots,
  publishBracket,
  unpublishBracket,
} from "./bracketActions";

type RegInfo = { name: string; club: string | null; number: string | null };
type Ring = { id: string; name: string; join_code: string };

export default async function BracketView({
  eventId,
  categoryId,
  canEdit,
  backHref,
  backLabel,
}: {
  eventId: string;
  categoryId: string;
  canEdit: boolean;
  backHref: string;
  backLabel: string;
}) {
  const supabase = supabaseAdmin();
  const { data: event } = await supabase.from("events").select("id, name").eq("id", eventId).maybeSingle();
  const { data: category } = await supabase.from("event_categories").select("id, name").eq("id", categoryId).maybeSingle();
  if (!event || !category) notFound();

  const { data: bracket } = await supabase.from("event_category_brackets").select("*").eq("event_category_id", category.id).maybeSingle();
  const { data: matches } = await supabase.from("event_matches").select("*").eq("category_id", category.id).order("slot");

  const regIds = new Set<string>();
  (matches ?? []).forEach((m) => {
    if (m.competitor1_registration_id) regIds.add(m.competitor1_registration_id);
    if (m.competitor2_registration_id) regIds.add(m.competitor2_registration_id);
  });
  const regMap = new Map<string, RegInfo>();
  if (regIds.size > 0) {
    const { data: regs } = await supabase
      .from("event_registrations")
      .select("id, competition_number, is_team, team_name, students(full_name), clubs(name)")
      .in("id", Array.from(regIds));
    (regs ?? []).forEach((r: any) => {
      regMap.set(r.id, {
        name: competitorName(r),
        club: r.clubs?.name ?? null,
        number: r.competition_number != null ? String(r.competition_number) : null,
      });
    });
  }
  const nameOf = (id: string | null) => (id ? regMap.get(id) ?? null : null);

  // Rings this event is running, so a bout can be sent straight to one.
  const { data: rings } = await supabase
    .from("scoreboard_rings")
    .select("id, name, join_code")
    .eq("event_id", eventId)
    .order("created_at");

  const isPublished = bracket?.status === "published";
  const hasMatches = (matches ?? []).length > 0;
  const mainRounds = ROUND_ORDER.filter((r) => (matches ?? []).some((m) => m.round === r));
  const finalMatch = (matches ?? []).find((m) => m.round === "final") ?? null;
  const firstRoundMatches = mainRounds.length > 0 ? (matches ?? []).filter((m) => m.round === mainRounds[0]) : [];
  const podium = placings((matches ?? []) as any);

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
            <p className="mt-1 text-sm text-gray-500">{event.name} — Draw</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{isPublished ? "Published" : "Draft"}</span>
            <Link href={backHref} className="btn-secondary">{backLabel}</Link>
            {hasMatches && (
              <a href={`/api/public/draw?categoryId=${category.id}&download=1`} className="btn-secondary">Export PDF</a>
            )}
            {canEdit && !isPublished && (
              <form action={generateBracket}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="categoryId" value={category.id} />
                <button type="submit" className="btn-secondary">{hasMatches ? "Regenerate draw" : "Generate draw"}</button>
              </form>
            )}
            {canEdit && !isPublished && hasMatches && (
              <form action={publishBracket}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="categoryId" value={category.id} />
                <button type="submit" className="btn-primary">Publish</button>
              </form>
            )}
            {canEdit && isPublished && (
              <form action={unpublishBracket}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="categoryId" value={category.id} />
                <button type="submit" className="btn-secondary">Unpublish (edit again)</button>
              </form>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Draws are seeded to avoid pairing competitors from the same club or country in the first round wherever
          possible — same country is only paired if there&apos;s no other option, and same club only as a last resort.
          Both beaten semi-finalists take a bronze, so there is no third-place match.
        </p>
      </div>

      {!hasMatches ? (
        <div className="card p-6 text-center text-sm text-gray-500">
          No draw generated yet. Confirm this category&apos;s competitors first, then click &quot;Generate draw.&quot;
        </div>
      ) : (
        <div className="card p-6">
          <div className="overflow-x-auto">
            <div className="flex gap-8">
              {mainRounds.map((round) => {
                const roundMatches = (matches ?? []).filter((m) => m.round === round).sort((a, b) => a.slot - b.slot);
                return (
                  <div key={round} className="flex min-w-[260px] flex-col justify-around gap-6">
                    <h3 className="text-center text-xs font-semibold uppercase tracking-wide text-gray-500">{ROUND_LABELS[round]}</h3>
                    {roundMatches.map((m) => (
                      <MatchBox
                        key={m.id}
                        match={m}
                        nameOf={nameOf}
                        canEdit={canEdit && !isPublished}
                        eventId={event.id}
                        categoryId={category.id}
                        rings={(rings ?? []) as Ring[]}
                      />
                    ))}
                  </div>
                );
              })}
              {finalMatch && (
                <div className="flex min-w-[180px] flex-col justify-center gap-3">
                  <h3 className="text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Winner!</h3>
                  {/* Empty until it is decided. A chart that says TBD in the
                      champion's box reads as a bout still to come. */}
                  <div className="min-h-[3rem] rounded-md border-2 border-yellow-400 bg-yellow-50 p-3 text-center text-sm font-semibold text-gray-900">
                    {finalMatch.winner_registration_id ? nameOf(finalMatch.winner_registration_id)?.name : ""}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* The podium sits under the draw, on the right, where the eye ends
              up after following the bracket across. */}
          <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
            <Podium podium={podium} nameOf={nameOf} />
          </div>

          {canEdit && !isPublished && firstRoundMatches.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <h3 className="text-sm font-semibold text-gray-900">Swap two competitors (first round)</h3>
              <p className="mt-1 text-xs text-gray-500">Manually adjust the auto-generated draw before publishing.</p>
              <form action={swapBracketSlots} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="categoryId" value={category.id} />
                <SwapSelect matches={firstRoundMatches} nameOf={nameOf} fieldName="a" />
                <span className="text-gray-400">⇄</span>
                <SwapSelect matches={firstRoundMatches} nameOf={nameOf} fieldName="b" />
                <button type="submit" className="btn-secondary">Swap</button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 1st, 2nd and two 3rds, read off the draw. */
function Podium({
  podium,
  nameOf,
}: {
  podium: { first: string | null; second: string | null; thirds: string[] };
  nameOf: (id: string | null) => RegInfo | null;
}) {
  const rows: { place: string; id: string | null; style: string }[] = [
    { place: "1st", id: podium.first, style: "bg-yellow-100 text-yellow-900" },
    { place: "2nd", id: podium.second, style: "bg-gray-200 text-gray-800" },
    { place: "3rd", id: podium.thirds[0] ?? null, style: "bg-amber-100 text-amber-900" },
    { place: "3rd", id: podium.thirds[1] ?? null, style: "bg-amber-100 text-amber-900" },
  ];

  return (
    <div className="w-full max-w-xs rounded-md border border-gray-200 bg-gray-50 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Placings</h3>
      <ul className="mt-2 space-y-1">
        {rows.map((row, i) => {
          const who = nameOf(row.id);
          return (
            <li key={`${row.place}-${i}`} className="flex items-center gap-2 text-sm">
              <span className={`w-10 rounded px-1.5 py-0.5 text-center text-xs font-bold ${row.style}`}>{row.place}</span>
              {who ? (
                <span className="truncate font-medium text-gray-900">
                  {who.number ? <span className="mr-1 text-xs text-gray-400">#{who.number}</span> : null}
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
  );
}

function MatchBox({
  match,
  nameOf,
  canEdit,
  eventId,
  categoryId,
  rings,
}: {
  match: any;
  nameOf: (id: string | null) => RegInfo | null;
  canEdit: boolean;
  eventId: string;
  categoryId: string;
  rings: Ring[];
}) {
  const c1 = nameOf(match.competitor1_registration_id);
  const c2 = nameOf(match.competitor2_registration_id);
  const hasResult = match.winner_registration_id != null;
  const bothPresent = !!match.competitor1_registration_id && !!match.competitor2_registration_id;

  // A bye is an empty line, not the word "bye": the competitor walks through,
  // and printing anything for the opponent they never met reads as a real bout.
  //
  // An empty line only means a bye when somebody is standing opposite it. A
  // match with neither side filled is a future one, and still says TBD --
  // otherwise a half-drawn bracket is a column of blank boxes.
  const label = (info: RegInfo | null, present: boolean, opponentPresent: boolean) =>
    info ? info.name : present ? "—" : opponentPresent ? "" : "TBD";

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 text-sm shadow-sm">
      <MatchRow
        label={label(c1, !!match.competitor1_registration_id, !!match.competitor2_registration_id)}
        sub={c1?.club}
        number={c1?.number}
        won={hasResult && match.winner_registration_id === match.competitor1_registration_id}
        points={match.competitor1_points}
      />
      <div className="my-1 border-t border-dashed border-gray-200" />
      <MatchRow
        label={label(c2, !!match.competitor2_registration_id, !!match.competitor1_registration_id)}
        sub={c2?.club}
        number={c2?.number}
        won={hasResult && match.winner_registration_id === match.competitor2_registration_id}
        points={match.competitor2_points}
      />

      {canEdit && bothPresent && (
        <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
          <form action={submitMatchResult} className="flex items-center gap-1">
            <input type="hidden" name="matchId" value={match.id} />
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="categoryId" value={categoryId} />
            <input name="points1" type="number" min={0} max={5} defaultValue={match.competitor1_points ?? ""} className="input !w-14 !px-1 !py-1 text-center text-xs" />
            <span className="text-gray-400">-</span>
            <input name="points2" type="number" min={0} max={5} defaultValue={match.competitor2_points ?? ""} className="input !w-14 !px-1 !py-1 text-center text-xs" />
            <button type="submit" className="btn-primary !px-2 !py-1 text-xs">{hasResult ? "Update" : "Save"}</button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sending a bout to a ring loads both corners and their numbers
                onto the scoreboard, so nobody types the names a second time. */}
            {rings.length > 0 && !hasResult && (
              <form action={sendMatchToRing} className="flex items-center gap-1">
                <input type="hidden" name="matchId" value={match.id} />
                <input type="hidden" name="eventId" value={eventId} />
                {rings.length === 1 ? (
                  <input type="hidden" name="ringId" value={rings[0].id} />
                ) : (
                  <select name="ringId" className="input !w-24 !px-1 !py-1 text-xs" defaultValue={rings[0].id}>
                    {rings.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                  </select>
                )}
                <button type="submit" className="text-xs font-medium text-brand-700 hover:underline">Score on ring</button>
              </form>
            )}
            {hasResult && (
              <Link href={`/events/${eventId}/matches/${match.id}`} className="text-xs font-medium text-brand-700 hover:underline">
                Match record
              </Link>
            )}
            {hasResult && (
              <form action={clearMatchResult}>
                <input type="hidden" name="matchId" value={match.id} />
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="categoryId" value={categoryId} />
                <button type="submit" className="text-xs font-medium text-red-600 hover:underline">Clear result</button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MatchRow({
  label,
  sub,
  number,
  won,
  points,
}: {
  label: string;
  sub?: string | null;
  number?: string | null;
  won?: boolean;
  points?: number | null;
}) {
  // An empty label is a bye — the line stays, so the box keeps its shape and
  // the pairing still reads as one competitor against nobody.
  if (!label) return <div className="h-6" />;

  return (
    <div
      className={`flex items-center justify-between rounded px-1.5 py-0.5 ${
        won ? "bg-green-100 font-bold text-green-900" : "text-gray-800"
      }`}
    >
      <span className="truncate">
        {number && <span className="mr-1 text-xs font-normal text-gray-400">#{number}</span>}
        {label}
        {sub && <span className="ml-1 text-xs font-normal text-gray-400">({sub})</span>}
      </span>
      {points != null && <span className={`ml-2 text-xs ${won ? "font-bold text-green-900" : "text-gray-500"}`}>{points}</span>}
    </div>
  );
}

function SwapSelect({
  matches,
  nameOf,
  fieldName,
}: {
  matches: any[];
  nameOf: (id: string | null) => RegInfo | null;
  fieldName: string;
}) {
  const options = matches.flatMap((m) => {
    const opts: { ref: string; label: string }[] = [];
    if (m.competitor1_registration_id) opts.push({ ref: `${m.id}:1`, label: nameOf(m.competitor1_registration_id)?.name ?? "—" });
    if (m.competitor2_registration_id) opts.push({ ref: `${m.id}:2`, label: nameOf(m.competitor2_registration_id)?.name ?? "—" });
    return opts;
  });
  return (
    <select name={fieldName} className="input max-w-[220px]" required defaultValue="">
      <option value="" disabled>Select a competitor</option>
      {options.map((opt) => (<option key={opt.ref} value={opt.ref}>{opt.label}</option>))}
    </select>
  );
}
