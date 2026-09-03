/**
 * Power test and special technique: the disciplines that are measured rather
 * than fought.
 *
 * Nobody faces anybody. Each competitor takes a set number of attempts at each
 * of a set list of techniques; what they achieve is measured, and the category
 * is ranked on the totals.
 *
 * Deliberately plain, like src/lib/scoreboard.ts -- no database, no React --
 * so the arithmetic that decides a placing can be checked outright.
 */

export type MeasuredKind = "power_test" | "special_technique";

/**
 * The ITF special techniques, in the order they are performed.
 *
 * All five are jumping kicks at a board held at a measured height, and the
 * result is that height. Korean names because that is what is called in the
 * ring and printed on the score sheet; the English is there for anybody
 * reading a result who does not have them by heart.
 */
export const SPECIAL_TECHNIQUES = [
  { key: "twimyo_nopi_ap_chagi", name: "Twimyo Nopi Ap Chagi", english: "Jumping high front kick" },
  { key: "twimyo_dollyo_chagi", name: "Twimyo Dollyo Chagi", english: "Jumping turning kick" },
  { key: "twimyo_bandae_dollyo_chagi", name: "Twimyo Bandae Dollyo Chagi", english: "Jumping reverse turning kick" },
  { key: "twimyo_yop_chagi", name: "Twimyo Yop Chagi", english: "Jumping side piercing kick" },
  { key: "twio_nomo_yop_chagi", name: "Twio Nomo Yop Chagi", english: "Jumping over an obstacle, side kick" },
] as const;

/**
 * The ITF power test techniques.
 *
 * The result is boards broken. Hand techniques and kicks are tested separately
 * because they break at very different rates, and a category usually picks a
 * subset rather than running all five.
 */
export const POWER_TECHNIQUES = [
  { key: "ap_joomuk_jirugi", name: "Ap Joomuk Jirugi", english: "Forefist punch" },
  { key: "sonkal_taerigi", name: "Sonkal Taerigi", english: "Knife hand strike" },
  { key: "yop_chagi", name: "Yop Chagi", english: "Side piercing kick" },
  { key: "dollyo_chagi", name: "Dollyo Chagi", english: "Turning kick" },
  { key: "bandae_dollyo_chagi", name: "Bandae Dollyo Chagi", english: "Reverse turning kick" },
] as const;

export type Technique = { key: string; name: string; english: string };

export function techniquesFor(kind: MeasuredKind): readonly Technique[] {
  return kind === "special_technique" ? SPECIAL_TECHNIQUES : POWER_TECHNIQUES;
}

/** What the number against an attempt means, for labelling a column. */
export const RESULT_UNIT: Record<MeasuredKind, { label: string; short: string; step: number }> = {
  power_test: { label: "Boards broken", short: "boards", step: 1 },
  special_technique: { label: "Height reached", short: "cm", step: 5 },
};

/** Which of the two a category type is, or null if it is neither. */
export function measuredKindOf(categoryType: string | null | undefined): MeasuredKind | null {
  if (categoryType === "power_breaking") return "power_test";
  if (categoryType === "special_event") return "special_technique";
  return null;
}

export type Attempt = {
  registrationId: string;
  technique: string;
  attemptNo: number;
  result: number;
  /** A missed attempt counts for nothing, and is not the same as one not taken. */
  scored: boolean;
};

/**
 * A competitor's mark at one technique: their best attempt at it.
 *
 * Best rather than last or average, in both disciplines. A power test is five
 * attempts to break as much as you can and the answer is the most you broke; a
 * special technique is attempts at a rising board and the answer is the
 * highest you reached. An attempt that missed contributes nothing but is not a
 * zero that drags anything down -- it simply is not the best.
 */
export function bestAt(attempts: Attempt[], registrationId: string, technique: string): number {
  const mine = attempts.filter(
    (a) => a.registrationId === registrationId && a.technique === technique && a.scored,
  );
  if (mine.length === 0) return 0;
  return mine.reduce((best, a) => (a.result > best ? a.result : best), 0);
}

/** How many attempts a competitor has actually taken at one technique. */
export function takenAt(attempts: Attempt[], registrationId: string, technique: string): number {
  return attempts.filter((a) => a.registrationId === registrationId && a.technique === technique).length;
}

export type Standing = {
  registrationId: string;
  /** Best at each technique, in the order the techniques were given. */
  perTechnique: number[];
  total: number;
  /** Attempts taken across every technique -- the first tie-break. */
  attemptsTaken: number;
  /** 1-based. Competitors who cannot be separated share a place. */
  place: number;
  /** True when somebody else holds the same place. */
  tied: boolean;
};

/**
 * The category's order of finish.
 *
 * Ranked on the total, and a tie broken by who needed fewer attempts to get
 * there -- breaking four boards first time is a better performance than
 * breaking four on the third go, and this is the measure officials reach for
 * before ordering a re-try.
 *
 * Anything still level after that is left level. Two competitors who did the
 * same thing in the same number of attempts share the place, and separating
 * them is a decision for the ring, not a rounding artefact of whichever row
 * the database happened to return first.
 */
export function standings(
  attempts: Attempt[],
  registrationIds: string[],
  techniques: readonly string[],
): Standing[] {
  const rows = registrationIds.map((registrationId) => {
    const perTechnique = techniques.map((t) => bestAt(attempts, registrationId, t));
    const total = perTechnique.reduce((sum, n) => sum + n, 0);
    const attemptsTaken = techniques.reduce((sum, t) => sum + takenAt(attempts, registrationId, t), 0);
    return { registrationId, perTechnique, total: round2(total), attemptsTaken, place: 0, tied: false };
  });

  rows.sort((a, b) => b.total - a.total || a.attemptsTaken - b.attemptsTaken);

  // Equal performances share a place, and the next one down is pushed past
  // them -- two firsts are followed by a third, not by a second.
  let place = 0;
  let seen = 0;
  let previous: Standing | null = null;
  for (const row of rows) {
    seen++;
    const same = previous !== null && previous.total === row.total && previous.attemptsTaken === row.attemptsTaken;
    if (!same) place = seen;
    row.place = place;
    if (same) {
      row.tied = true;
      previous!.tied = true;
    }
    previous = row;
  }
  return rows;
}

/** Nobody has done anything yet, so there is nothing to rank. */
export function noneAttempted(attempts: Attempt[]): boolean {
  return attempts.length === 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
