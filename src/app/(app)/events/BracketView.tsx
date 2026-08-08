import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ROUND_ORDER, ROUND_LABELS } from "@/lib/bracket";
import { generateBracket, submitMatchResult, swapBracketSlots, publishBracket, unpublishBracket } from "./bracketActions";
type RegInfo = { name: string; club: string | null };
export default async function BracketView({ eventId, categoryId, canEdit, backHref, backLabel }: { eventId: string; categoryId: string; canEdit: boolean; backHref: string; backLabel: string }) {
  const supabase = supabaseAdmin();
  const { data: event } = await supabase.from("events").select("id, name").eq("id", eventId).maybeSingle();
  const { data: category } = await supabase.from("event_categories").select("id, name").eq("id", categoryId).maybeSingle();
  if (!event || !category) notFound();
  const { data: bracket } = await supabase.from("event_category_brackets").select("*").eq("event_category_id", category.id).maybeSingle();
  const { data: matches } = await supabase.from("event_matches").select("*").eq("category_id", category.id).order("slot");
  const regIds = new Set<string>();
  (matches ?? []).forEach((m) => { if (m.competitor1_registration_id) regIds.add(m.competitor1_registration_id); if (m.competitor2_registration_id) regIds.add(m.competitor2_registration_id); });
  const regMap = new Map<string, RegInfo>();
  if (regIds.size > 0) {
    const { data: regs } = await supabase.from("event_registrations").select("id, students(first_name, last_name), clubs(name)").in("id", Array.from(regIds));
    (regs ?? []).forEach((r: any) => { regMap.set(r.id, { name: `${r.students?.first_name ?? ""} ${r.students?.last_name ?? ""}`.trim(), club: r.clubs?.name ?? null }); });
  }
  const nameOf = (id: string | null) => (id ? regMap.get(id) ?? null : null);
  const isPublished = bracket?.status === "published";
  const hasMatches = (matches ?? []).length > 0;
  const mainRounds = ROUND_ORDER.filter((r) => (matches ?? []).some((m) => m.round === r));
  const thirdPlaceMatch = (matches ?? []).find((m) => m.round === "third_place") ?? null;
  const finalMatch = (matches ?? []).find((m) => m.round === "final") ?? null;
  const firstRoundMatches = mainRounds.length > 0 ? (matches ?? []).filter((m) => m.round === mainRounds[0]) : [];
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="text-xl font-bold text-gray-900">{category.name}</h2><p className="mt-1 text-sm text-gray-500">{event.name} — Draws</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{isPublished ? "Published" : "Draft"}</span>
            <Link href={backHref} className="btn-secondary">{backLabel}</Link>
            {canEdit && !isPublished && (
              <form action={generateBracket}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="categoryId" value={category.id} />
                <button type="submit" className="btn-secondary">{hasMatches ? "Regenerate bracket" : "Generate bracket"}</button>
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
        <p className="mt-2 text-xs text-gray-400">Draws are seeded to avoid pairing competitors from the same club or country in the first round wherever possible — same country is only paired if there's no other option, and same club only as a last resort. Points are 0–5 per side; the higher score advances.</p>
      </div>
      {!hasMatches ? (
        <div className="card p-6 text-center text-sm text-gray-500">No draw generated yet. Confirm this category's competitors first, then click "Generate bracket."</div>
      ) : (
        <div className="card overflow-x-auto p-6">
          <div className="flex gap-8">
            {mainRounds.map((round) => {
              const roundMatches = (matches ?? []).filter((m) => m.round === round).sort((a, b) => a.slot - b.slot);
              return (
                <div key={round} className="flex min-w-[220px] flex-col justify-around gap-6">
                  <h3 className="text-center text-xs font-semibold uppercase tracking-wide text-gray-500">{ROUND_LABELS[round]}</h3>
                  {roundMatches.map((m) => (<MatchBox key={m.id} match={m} nameOf={nameOf} canEdit={canEdit && !isPublished} eventId={event.id} categoryId={category.id} />))}
                </div>
              );
            })}
            {finalMatch && (
              <div className="flex min-w-[180px] flex-col justify-center gap-3">
                <h3 className="text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Winner!</h3>
                <div className="rounded-md border-2 border-yellow-400 bg-yellow-50 p-3 text-center text-sm font-semibold text-gray-900">{finalMatch.winner_registration_id ? nameOf(finalMatch.winner_registration_id)?.name : "TBD"}</div>
              </div>
            )}
          </div>
          {thirdPlaceMatch && (
            <div className="mt-8 border-t border-gray-100 pt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Third Place Match</h3>
              <div className="mt-3 max-w-xs"><MatchBox match={thirdPlaceMatch} nameOf={nameOf} canEdit={canEdit && !isPublished} eventId={event.id} categoryId={category.id} /></div>
            </div>
          )}
          {canEdit && !isPublished && firstRoundMatches.length > 0 && (
            <div className="mt-8 border-t border-gray-100 pt-6">
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
function MatchBox({ match, nameOf, canEdit, eventId, categoryId }: { match: any; nameOf: (id: string | null) => RegInfo | null; canEdit: boolean; eventId: string; categoryId: string }) {
  const c1 = nameOf(match.competitor1_registration_id);
  const c2 = nameOf(match.competitor2_registration_id);
  const hasResult = match.winner_registration_id != null;
  const bothPresent = !!match.competitor1_registration_id && !!match.competitor2_registration_id;
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 text-sm shadow-sm">
      <MatchRow label={c1?.name ?? (match.competitor1_registration_id ? "—" : match.competitor2_registration_id ? "(bye)" : "TBD")} sub={c1?.club} won={hasResult && match.winner_registration_id === match.competitor1_registration_id} points={match.competitor1_points} />
      <div className="my-1 border-t border-dashed border-gray-200" />
      <MatchRow label={c2?.name ?? (match.competitor2_registration_id ? "—" : match.competitor1_registration_id ? "(bye)" : "TBD")} sub={c2?.club} won={hasResult && match.winner_registration_id === match.competitor2_registration_id} points={match.competitor2_points} />
      {canEdit && bothPresent && (
        <form action={submitMatchResult} className="mt-2 flex items-center gap-1 border-t border-gray-100 pt-2">
          <input type="hidden" name="matchId" value={match.id} />
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="categoryId" value={categoryId} />
          <input name="points1" type="number" min={0} max={5} defaultValue={match.competitor1_points ?? ""} className="input !w-14 !px-1 !py-1 text-center text-xs" />
          <span className="text-gray-400">-</span>
          <input name="points2" type="number" min={0} max={5} defaultValue={match.competitor2_points ?? ""} className="input !w-14 !px-1 !py-1 text-center text-xs" />
          <button type="submit" className="btn-primary !px-2 !py-1 text-xs">{hasResult ? "Update" : "Save"}</button>
        </form>
      )}
    </div>
  );
}
function MatchRow({ label, sub, won, points }: { label: string; sub?: string | null; won?: boolean; points?: number | null }) {
  return (
    <div className={`flex items-center justify-between ${won ? "font-semibold text-brand-700" : "text-gray-800"}`}>
      <span>{label}{sub && <span className="ml-1 text-xs font-normal text-gray-400">({sub})</span>}</span>
      {points != null && <span className="text-xs text-gray-500">{points}</span>}
    </div>
  );
}
function SwapSelect({ matches, nameOf, fieldName }: { matches: any[]; nameOf: (id: string | null) => RegInfo | null; fieldName: string }) {
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
