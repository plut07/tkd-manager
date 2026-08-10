import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ROUND_ORDER, ROUND_LABELS } from "@/lib/bracket";

// These pages read live data but never touch cookies, so Next would otherwise
// prerender them at build time and keep serving that snapshot — edits and
// deletions wouldn't show until the next deploy. Force a fresh query per request.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RegInfo = { name: string; club: string | null };

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
      .select("id, students(full_name), clubs(name)")
      .in("id", Array.from(regIds));
    (regs ?? []).forEach((r: any) => {
      regMap.set(r.id, {
        name: r.students?.full_name ?? "",
        club: r.clubs?.name ?? null,
      });
    });
  }
  const nameOf = (id: string | null) => (id ? regMap.get(id) ?? null : null);

  const mainRounds = ROUND_ORDER.filter((r) => (matches ?? []).some((m) => m.round === r));
  const thirdPlaceMatch = (matches ?? []).find((m) => m.round === "third_place") ?? null;
  const finalMatch = (matches ?? []).find((m) => m.round === "final") ?? null;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
            <p className="mt-1 text-sm text-gray-500">{event.name} — Bracket</p>
          </div>
          <Link href={`/public/events/${event.id}`} className="btn-secondary">
            Back to event
          </Link>
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
              <div className="rounded-md border-2 border-yellow-400 bg-yellow-50 p-3 text-center text-sm font-semibold text-gray-900">
                {finalMatch.winner_registration_id ? nameOf(finalMatch.winner_registration_id)?.name : "TBD"}
              </div>
            </div>
          )}
        </div>

        {thirdPlaceMatch && (
          <div className="mt-8 border-t border-gray-100 pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Third Place Match</h3>
            <div className="mt-3 max-w-xs">
              <MatchBox match={thirdPlaceMatch} nameOf={nameOf} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchBox({ match, nameOf }: { match: any; nameOf: (id: string | null) => RegInfo | null }) {
  const c1 = nameOf(match.competitor1_registration_id);
  const c2 = nameOf(match.competitor2_registration_id);
  const hasResult = match.winner_registration_id != null;

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 text-sm shadow-sm">
      <MatchRow
        label={c1?.name ?? (match.competitor1_registration_id ? "—" : match.competitor2_registration_id ? "(bye)" : "TBD")}
        sub={c1?.club}
        won={hasResult && match.winner_registration_id === match.competitor1_registration_id}
        points={match.competitor1_points}
      />
      <div className="my-1 border-t border-dashed border-gray-200" />
      <MatchRow
        label={c2?.name ?? (match.competitor2_registration_id ? "—" : match.competitor1_registration_id ? "(bye)" : "TBD")}
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
  return (
    <div className={`flex items-center justify-between ${won ? "font-semibold text-brand-700" : "text-gray-800"}`}>
      <span>
        {label}
        {sub && <span className="ml-1 text-xs font-normal text-gray-400">({sub})</span>}
      </span>
      {points != null && <span className="text-xs text-gray-500">{points}</span>}
    </div>
  );
}
