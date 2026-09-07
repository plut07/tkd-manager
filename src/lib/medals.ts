/**
 * Who won what, once the day is over.
 *
 * A competition ends with a filled-in draw per category and nothing that says
 * "here is the result of the event". This turns the one into the other: a
 * podium per category, and a medal table across all of them.
 *
 * Nothing is stored. Medals are read off the draws and the score sheets every
 * time, exactly as the podium on a single bracket already is -- so correcting a
 * bout corrects the medal table, and there is no second copy of the truth to
 * drift out of step with the first.
 *
 * Deliberately plain, like scoreboard.ts and measured.ts: no database, no
 * React, so the arithmetic behind a medal can be checked outright.
 */

export type Medal = "gold" | "silver" | "bronze";

/** One competitor's place in one category. */
export type Placement = {
  categoryId: string;
  registrationId: string;
  medal: Medal;
};

/**
 * A podium, as the draw or the score sheet reports it.
 *
 * `thirds` is a list because Taekwon-Do awards two bronzes -- both beaten
 * semi-finalists take one, and there is no third-place match for them to fight
 * over. A measured discipline has one third, so it simply has a shorter list.
 */
export type Podium = { first: string | null; second: string | null; thirds: string[] };

/** The placements a podium represents, ready to be counted. */
export function placementsOf(categoryId: string, podium: Podium): Placement[] {
  const out: Placement[] = [];
  if (podium.first) out.push({ categoryId, registrationId: podium.first, medal: "gold" });
  if (podium.second) out.push({ categoryId, registrationId: podium.second, medal: "silver" });
  for (const third of podium.thirds) {
    if (third) out.push({ categoryId, registrationId: third, medal: "bronze" });
  }
  return out;
}

export type MedalRow = {
  /** Club id, or country code — whichever the table is grouped by. */
  key: string;
  name: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  /** 1-based. Groups that cannot be separated share a rank. */
  rank: number;
  tied: boolean;
};

/**
 * The medal table.
 *
 * Ordered the way medal tables are always ordered: most golds first, and only
 * then most silvers, and only then most bronzes. A single gold outranks any
 * number of silvers -- which is the whole convention, and the thing people
 * notice immediately if it is got wrong by ranking on the total instead.
 *
 * Groups that are identical on all three share a rank, and the next group down
 * is pushed past them: two firsts are followed by a third.
 */
export function medalTable(
  placements: Placement[],
  groupOf: (registrationId: string) => { key: string; name: string } | null,
): MedalRow[] {
  const rows = new Map<string, MedalRow>();

  for (const placement of placements) {
    const group = groupOf(placement.registrationId);
    // A medallist whose club we cannot resolve is left out rather than filed
    // under a blank name — an empty row at the top of a medal table is worse
    // than a missing one.
    if (!group) continue;

    const row =
      rows.get(group.key) ??
      { key: group.key, name: group.name, gold: 0, silver: 0, bronze: 0, total: 0, rank: 0, tied: false };
    if (placement.medal === "gold") row.gold++;
    else if (placement.medal === "silver") row.silver++;
    else row.bronze++;
    row.total++;
    rows.set(group.key, row);
  }

  const list = Array.from(rows.values()).sort(
    (a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || a.name.localeCompare(b.name),
  );

  let rank = 0;
  let seen = 0;
  let previous: MedalRow | null = null;
  for (const row of list) {
    seen++;
    const same =
      previous !== null &&
      previous.gold === row.gold &&
      previous.silver === row.silver &&
      previous.bronze === row.bronze;
    if (!same) rank = seen;
    row.rank = rank;
    if (same) {
      row.tied = true;
      previous!.tied = true;
    }
    previous = row;
  }
  return list;
}

/**
 * Whether a category has finished.
 *
 * A category with a gold has been decided. One without is still running, and
 * showing it on a results page as though nobody won would read as a result
 * rather than as an absence.
 */
export function isDecided(podium: Podium): boolean {
  return podium.first !== null;
}

/** Gold, silver, bronze, bronze — in the order a result sheet prints them. */
export const MEDAL_ORDER: Medal[] = ["gold", "silver", "bronze"];

export const MEDAL_LABELS: Record<Medal, string> = {
  gold: "1st",
  silver: "2nd",
  bronze: "3rd",
};
