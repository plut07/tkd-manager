import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { baseUrl } from "@/lib/urls";
import ScoreboardControl from "@/components/ScoreboardControl";
import { loadRing, createRing, deleteRing } from "./scoreboardActions";
import { competitorName } from "@/lib/competitors";

/**
 * Running the rings for one event.
 *
 * Lives here rather than on its own page because the draw and the scoreboard
 * are the same job from the operator's side: pick the next bout, score it, send
 * the winner on. It is still reachable at its own address so it can be opened
 * on a second screen.
 */
export default async function ScoreboardTab({
  eventId,
  ringId,
  hrefFor,
}: {
  eventId: string;
  ringId?: string;
  hrefFor: (ring: string) => string;
}) {
  const supabase = supabaseAdmin();

  const { data: rings } = await supabase
    .from("scoreboard_rings")
    .select("id, name, join_code, state")
    .eq("event_id", eventId)
    .order("created_at");

  const chosenId = ringId ?? (rings ?? [])[0]?.id ?? null;
  const ring = chosenId ? await loadRing({ ringId: chosenId }) : null;

  const { data: categories } = await supabase
    .from("event_categories")
    .select("id, name")
    .eq("event_id", eventId)
    .order("name");

  // Bouts are offered with both names spelled out, because "R2 S3" means
  // nothing to somebody looking at two people standing in front of them.
  const { data: matchRows } = await supabase
    .from("event_matches")
    .select("id, round, slot, category_id, winner_registration_id, competitor1_registration_id, competitor2_registration_id")
    .eq("event_id", eventId)
    .order("round")
    .order("slot");

  // Names are looked up in a second pass rather than joined, the same way the
  // draw does it — one query for everyone in it, then matched up here.
  const regIds = Array.from(
    new Set(
      (matchRows ?? [])
        .flatMap((m: any) => [m.competitor1_registration_id, m.competitor2_registration_id])
        .filter(Boolean) as string[],
    ),
  );
  type Competitor = { name: string; number: string | null };
  let byReg = new Map<string, Competitor>();
  if (regIds.length > 0) {
    const { data: regs } = await supabase
      .from("event_registrations")
      .select("id, competition_number, is_team, team_name, students(full_name)")
      .in("id", regIds);
    byReg = new Map<string, Competitor>(
      (regs ?? []).map((r: any) => [
        r.id,
        { name: competitorName(r), number: r.competition_number != null ? String(r.competition_number) : null },
      ] as [string, Competitor]),
    );
  }

  const matches = (matchRows ?? []).map((m: any) => {
    const red = byReg.get(m.competitor1_registration_id) ?? null;
    const blue = byReg.get(m.competitor2_registration_id) ?? null;
    const show = (c: Competitor | null) => (c ? `${c.number ? `#${c.number} ` : ""}${c.name}` : "TBC");
    return {
      id: m.id,
      categoryId: m.category_id,
      red: red?.name || null,
      blue: blue?.name || null,
      redNumber: red?.number ?? null,
      blueNumber: blue?.number ?? null,
      label: `R${m.round}.${m.slot} — ${show(red)} v ${show(blue)}${m.winner_registration_id ? " (done)" : ""}`,
    };
  });

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(rings ?? []).map((r: any) => (
            <Link
              key={r.id}
              href={hrefFor(r.id)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                r.id === chosenId ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {r.name}
              <span className="ml-2 font-mono text-xs text-gray-400">{r.join_code}</span>
            </Link>
          ))}

          <form action={createRing} className="flex items-center gap-2">
            <input type="hidden" name="eventId" value={eventId} />
            <input name="name" className="input !w-32 !py-1 text-sm" placeholder={`Ring ${(rings ?? []).length + 1}`} />
            <button type="submit" className="btn-secondary !px-3 !py-1.5 text-xs">Add ring</button>
          </form>

          {ring && (
            <form action={deleteRing} className="ml-auto">
              <input type="hidden" name="ringId" value={ring.id} />
              <input type="hidden" name="eventId" value={eventId} />
              <button type="submit" className="text-sm font-medium text-red-600 hover:underline">Delete this ring</button>
            </form>
          )}
        </div>
      </div>

      {ring ? (
        <ScoreboardControl initial={ring} categories={(categories ?? []) as any} matches={matches} baseUrl={baseUrl()} />
      ) : (
        <div className="card p-8 text-center text-gray-500">
          No rings yet. Add one above and you&apos;ll get a join code for the judges.
        </div>
      )}
    </div>
  );
}
