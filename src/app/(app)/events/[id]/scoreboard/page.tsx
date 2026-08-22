import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { baseUrl } from "@/lib/urls";
import ScoreboardControl from "@/components/ScoreboardControl";
import { loadRing, createRing, deleteRing } from "../../scoreboardActions";

export const dynamic = "force-dynamic";

/**
 * Running the ring.
 *
 * An event can have several rings going at once, each with its own join code,
 * so this page is a list of rings with one of them opened. The judges never see
 * it — they only ever get the join code.
 */
export default async function ScoreboardPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ring?: string };
}) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const supabase = supabaseAdmin();

  const { data: event } = await supabase.from("events").select("id, name, event_type").eq("id", params.id).maybeSingle();
  if (!event) notFound();

  const { data: rings } = await supabase
    .from("scoreboard_rings")
    .select("id, name, join_code, state")
    .eq("event_id", params.id)
    .order("created_at");

  const chosenId = searchParams.ring ?? (rings ?? [])[0]?.id ?? null;
  const ring = chosenId ? await loadRing({ ringId: chosenId }) : null;

  const { data: categories } = await supabase
    .from("event_categories")
    .select("id, name")
    .eq("event_id", params.id)
    .order("name");

  // Bouts are offered with both names spelled out, because "R2 S3" means
  // nothing to somebody looking at two people standing in front of them.
  const { data: matchRows } = await supabase
    .from("event_matches")
    .select("id, round, slot, category_id, winner_registration_id, competitor1_registration_id, competitor2_registration_id")
    .eq("event_id", params.id)
    .order("round")
    .order("slot");

  // Names are looked up in a second pass rather than joined, the same way the
  // bracket does it — one query for everyone in the draw, then matched up here.
  const regIds = Array.from(
    new Set(
      (matchRows ?? [])
        .flatMap((m: any) => [m.competitor1_registration_id, m.competitor2_registration_id])
        .filter(Boolean) as string[],
    ),
  );
  let nameByReg = new Map<string, string>();
  if (regIds.length > 0) {
    const { data: regs } = await supabase
      .from("event_registrations")
      .select("id, students(full_name)")
      .in("id", regIds);
    nameByReg = new Map<string, string>(
      (regs ?? []).map((r: any) => [r.id, r.students?.full_name ?? ""] as [string, string]),
    );
  }

  const matches = (matchRows ?? []).map((m: any) => {
    const red = nameByReg.get(m.competitor1_registration_id) || null;
    const blue = nameByReg.get(m.competitor2_registration_id) || null;
    return {
      id: m.id,
      categoryId: m.category_id,
      red,
      blue,
      label: `R${m.round}.${m.slot} — ${red ?? "TBC"} v ${blue ?? "TBC"}${m.winner_registration_id ? " (done)" : ""}`,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Scoreboard — {event.name}</h1>
          <p className="text-sm text-gray-500">Judges score on their own phones. Nothing reaches the draw until you confirm it.</p>
        </div>
        <Link href={`/events/${params.id}`} className="btn-secondary">Back to event</Link>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(rings ?? []).map((r: any) => (
            <Link
              key={r.id}
              href={`/events/${params.id}/scoreboard?ring=${r.id}`}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                r.id === chosenId ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {r.name}
              <span className="ml-2 font-mono text-xs text-gray-400">{r.join_code}</span>
            </Link>
          ))}

          <form action={createRing} className="flex items-center gap-2">
            <input type="hidden" name="eventId" value={params.id} />
            <input name="name" className="input !w-32 !py-1 text-sm" placeholder={`Ring ${(rings ?? []).length + 1}`} />
            <button type="submit" className="btn-secondary !px-3 !py-1.5 text-xs">Add ring</button>
          </form>

          {ring && (
            <form action={deleteRing} className="ml-auto">
              <input type="hidden" name="ringId" value={ring.id} />
              <input type="hidden" name="eventId" value={params.id} />
              <button type="submit" className="text-sm font-medium text-red-600 hover:underline">Delete this ring</button>
            </form>
          )}
        </div>
      </div>

      {ring ? (
        <ScoreboardControl
          initial={ring}
          categories={(categories ?? []) as any}
          matches={matches}
          baseUrl={baseUrl()}
        />
      ) : (
        <div className="card p-8 text-center text-gray-500">
          No rings yet. Add one above and you&apos;ll get a join code for the judges.
        </div>
      )}
    </div>
  );
}
