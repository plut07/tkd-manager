import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { placings } from "@/lib/bracket";
import { competitorName } from "@/lib/competitors";
import { measuredKindOf, standings, techniquesFor, type Attempt } from "@/lib/measured";
import { placementsOf, medalTable, isDecided, type Placement, type Podium, type MedalRow } from "@/lib/medals";

/**
 * The result of a whole competition.
 *
 * Every category's podium, and the medal table across all of them. Gathered
 * rather than stored: a bracket already knows its own podium and a score sheet
 * already knows its own order of finish, so this asks them both and adds it up.
 * Correcting a bout therefore corrects the medal table, with no second copy of
 * the truth to drift out of step with the first.
 *
 * Both shapes of category are read the same way, because a result is a result:
 * a fought category's podium comes off the draw, a measured one's off the
 * attempts, and from here on nothing cares which was which.
 */

export type Medallist = {
  registrationId: string;
  name: string;
  clubName: string | null;
  competitionNumber: string | null;
  /** For a measured discipline: what they actually scored. */
  score: number | null;
};

export type CategoryResult = {
  categoryId: string;
  name: string;
  type: string | null;
  /** "Score sheet" categories are ranked on totals rather than fought. */
  measured: boolean;
  decided: boolean;
  first: Medallist | null;
  second: Medallist | null;
  thirds: Medallist[];
};

export type EventResults = {
  categories: CategoryResult[];
  byClub: MedalRow[];
  byCountry: MedalRow[];
  decidedCount: number;
  totalCount: number;
};

export async function loadEventResults(eventId: string): Promise<EventResults> {
  const supabase = supabaseAdmin();

  const { data: categories } = await supabase
    .from("event_categories")
    .select("id, name, type, measured_techniques")
    .eq("event_id", eventId)
    .order("sort_order")
    .order("name");

  const categoryList = (categories ?? []) as any[];
  if (categoryList.length === 0) {
    return { categories: [], byClub: [], byCountry: [], decidedCount: 0, totalCount: 0 };
  }
  const categoryIds = categoryList.map((c) => c.id);

  // Three reads for the whole event rather than three per category: a
  // championship has dozens of divisions and this page is opened while people
  // are waiting for it.
  const [{ data: matches }, { data: attemptRows }, { data: regs }] = await Promise.all([
    supabase
      .from("event_matches")
      .select("category_id, round, competitor1_registration_id, competitor2_registration_id, winner_registration_id")
      .in("category_id", categoryIds),
    supabase
      .from("event_attempts")
      .select("category_id, registration_id, technique, attempt_no, result, scored")
      .in("category_id", categoryIds),
    supabase
      .from("event_registrations")
      .select("id, category_id, status, competition_number, club_id, is_team, team_name, clubs(id, name, country), students(full_name, nationality)")
      .eq("event_id", eventId),
  ]);

  const registrations = (regs ?? []) as any[];
  const byId = new Map(registrations.map((r) => [r.id, r]));

  const medallistOf = (registrationId: string | null, score: number | null = null): Medallist | null => {
    if (!registrationId) return null;
    const reg = byId.get(registrationId);
    if (!reg) return null;
    return {
      registrationId,
      name: competitorName(reg),
      clubName: reg.clubs?.name ?? null,
      competitionNumber: reg.competition_number != null ? String(reg.competition_number) : null,
      score,
    };
  };

  const matchesByCategory = new Map<string, any[]>();
  for (const m of (matches ?? []) as any[]) {
    const list = matchesByCategory.get(m.category_id) ?? [];
    list.push(m);
    matchesByCategory.set(m.category_id, list);
  }

  const attemptsByCategory = new Map<string, Attempt[]>();
  for (const a of (attemptRows ?? []) as any[]) {
    const list = attemptsByCategory.get(a.category_id) ?? [];
    list.push({
      registrationId: a.registration_id,
      technique: a.technique,
      attemptNo: Number(a.attempt_no),
      result: Number(a.result),
      scored: a.scored !== false,
    });
    attemptsByCategory.set(a.category_id, list);
  }

  const results: CategoryResult[] = [];
  const placements: Placement[] = [];

  for (const category of categoryList) {
    const kind = measuredKindOf(category.type);
    let podium: Podium;
    const scoreOf = new Map<string, number>();

    if (kind) {
      // Ranked on totals. Only competitors who actually scored something can
      // take a medal — a category where nobody has been through yet would
      // otherwise hand gold to whoever the database returned first.
      const chosen: string[] = (category.measured_techniques ?? []).filter(Boolean);
      const techniques = chosen.length > 0 ? chosen : techniquesFor(kind).map((t) => t.key);
      const entrants = registrations
        .filter((r) => r.category_id === category.id && r.status === "confirmed")
        .map((r) => r.id);

      const table = standings(attemptsByCategory.get(category.id) ?? [], entrants, techniques)
        .filter((s) => s.total > 0);
      for (const row of table) scoreOf.set(row.registrationId, row.total);

      podium = {
        first: table.find((s) => s.place === 1)?.registrationId ?? null,
        second: table.find((s) => s.place === 2)?.registrationId ?? null,
        thirds: table.filter((s) => s.place === 3).map((s) => s.registrationId),
      };
    } else {
      podium = placings((matchesByCategory.get(category.id) ?? []) as any);
    }

    const decided = isDecided(podium);
    if (decided) placements.push(...placementsOf(category.id, podium));

    results.push({
      categoryId: category.id,
      name: category.name,
      type: category.type ?? null,
      measured: Boolean(kind),
      decided,
      first: medallistOf(podium.first, scoreOf.get(podium.first ?? "") ?? null),
      second: medallistOf(podium.second, scoreOf.get(podium.second ?? "") ?? null),
      thirds: podium.thirds
        .map((id) => medallistOf(id, scoreOf.get(id) ?? null))
        .filter((m): m is Medallist => m !== null),
    });
  }

  // A team's country is its club's; an individual's own nationality wins over
  // their club's country, since somebody may compete for a club abroad.
  const byClub = medalTable(placements, (id) => {
    const reg = byId.get(id);
    if (!reg?.clubs?.id) return null;
    return { key: reg.clubs.id, name: reg.clubs.name ?? "Unknown club" };
  });

  const byCountry = medalTable(placements, (id) => {
    const reg = byId.get(id);
    const code = reg?.students?.nationality || reg?.clubs?.country || null;
    if (!code) return null;
    return { key: code, name: code };
  });

  return {
    categories: results,
    byClub,
    byCountry,
    decidedCount: results.filter((r) => r.decided).length,
    totalCount: results.length,
  };
}
