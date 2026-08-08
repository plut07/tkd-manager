import { randomUUID } from "crypto";
export type BracketCompetitor = { registrationId: string; studentId: string; clubId: string | null; clubName: string | null; nationality: string | null };
export type MatchRow = { id: string; event_id: string; category_id: string; round: string; slot: number; competitor1_registration_id: string | null; competitor2_registration_id: string | null; competitor1_points: number | null; competitor2_points: number | null; winner_registration_id: string | null; next_match_id: string | null; next_slot: number | null; loser_next_match_id: string | null; loser_next_slot: number | null; is_third_place: boolean };
export const ROUND_ORDER = ["round_of_64", "round_of_32", "round_of_16", "quarterfinal", "semifinal", "final"];
export const ROUND_LABELS: Record<string, string> = { round_of_64: "Round of 64", round_of_32: "Round of 32", round_of_16: "Round of 16", quarterfinal: "Quarter-finals", semifinal: "Semi-finals", final: "Final", third_place: "Third Place Match" };
export function nextPowerOfTwo(n: number): number { let p = 2; while (p < n) p *= 2; return Math.max(p, 2); }
export function roundsForSize(size: number): string[] { const named = ROUND_ORDER.filter((_, i) => { const roundSize = 2 ** (ROUND_ORDER.length - i); return roundSize <= size; }); if (named.length > 0) return named; return ["final"]; }
function pairSeverity(a: BracketCompetitor, b: BracketCompetitor): number {
  if (a.clubId && b.clubId && a.clubId === b.clubId) return 2;
  if (a.nationality && b.nationality && a.nationality === b.nationality) return 1;
  return 0;
}
function buildFirstRoundPairs(competitors: BracketCompetitor[]): (BracketCompetitor | null)[][] {
  const pool = [...competitors];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const pairs: (BracketCompetitor | null)[][] = [];
  while (pool.length > 0) {
    const a = pool.shift()!;
    if (pool.length === 0) { pairs.push([a, null]); break; }
    let bestIndex = 0;
    let bestSeverity = pairSeverity(a, pool[0]);
    for (let i = 1; i < pool.length; i++) {
      const severity = pairSeverity(a, pool[i]);
      if (severity < bestSeverity) { bestSeverity = severity; bestIndex = i; if (severity === 0) break; }
    }
    const [b] = pool.splice(bestIndex, 1);
    pairs.push([a, b]);
  }
  return pairs;
}
export function seedBracket(competitors: BracketCompetitor[]): (BracketCompetitor | null)[] {
  const size = nextPowerOfTwo(competitors.length);
  const slots: (BracketCompetitor | null)[] = new Array(size).fill(null);
  const pairs = buildFirstRoundPairs(competitors);
  const byClub = new Map<string, (BracketCompetitor | null)[][]>();
  for (const pair of pairs) {
    const clubKey = pair[0]?.clubId ?? pair[1]?.clubId ?? `_solo_${pair[0]?.registrationId ?? pair[1]?.registrationId}`;
    if (!byClub.has(clubKey)) byClub.set(clubKey, []);
    byClub.get(clubKey)!.push(pair);
  }
  const groups = Array.from(byClub.values()).sort((a, b) => b.length - a.length);
  const orderedPairs: (BracketCompetitor | null)[][] = [];
  let remaining = pairs.length;
  while (remaining > 0) { for (const g of groups) { const next = g.shift(); if (next) { orderedPairs.push(next); remaining--; } } }
  orderedPairs.forEach((pair, i) => { slots[2 * i] = pair[0] ?? null; slots[2 * i + 1] = pair[1] ?? null; });
  return slots;
}
export function buildBracket(eventId: string, categoryId: string, competitors: BracketCompetitor[]): { matches: MatchRow[] } {
  const seeded = seedBracket(competitors);
  const size = seeded.length;
  const rounds = roundsForSize(size);
  const roundMatches: MatchRow[][] = rounds.map(() => []);
  const blank = (round: string, slot: number): MatchRow => ({ id: randomUUID(), event_id: eventId, category_id: categoryId, round, slot, competitor1_registration_id: null, competitor2_registration_id: null, competitor1_points: null, competitor2_points: null, winner_registration_id: null, next_match_id: null, next_slot: null, loser_next_match_id: null, loser_next_slot: null, is_third_place: false });
  const firstRoundCount = size / 2;
  for (let i = 0; i < firstRoundCount; i++) {
    const a = seeded[2 * i]; const b = seeded[2 * i + 1];
    const row = blank(rounds[0], i);
    row.competitor1_registration_id = a?.registrationId ?? null;
    row.competitor2_registration_id = b?.registrationId ?? null;
    if (a && !b) row.winner_registration_id = a.registrationId;
    if (b && !a) row.winner_registration_id = b.registrationId;
    roundMatches[0].push(row);
  }
  for (let r = 1; r < rounds.length; r++) {
    const count = roundMatches[r - 1].length / 2;
    for (let i = 0; i < count; i++) {
      const row = blank(rounds[r], i);
      const feederA = roundMatches[r - 1][2 * i]; const feederB = roundMatches[r - 1][2 * i + 1];
      feederA.next_match_id = row.id; feederA.next_slot = 1;
      feederB.next_match_id = row.id; feederB.next_slot = 2;
      if (feederA.winner_registration_id) row.competitor1_registration_id = feederA.winner_registration_id;
      if (feederB.winner_registration_id) row.competitor2_registration_id = feederB.winner_registration_id;
      roundMatches[r].push(row);
    }
  }
  const sfIndex = rounds.indexOf("semifinal");
  if (sfIndex >= 0 && roundMatches[sfIndex].length === 2) {
    const [sf1, sf2] = roundMatches[sfIndex];
    const thirdPlace = blank("third_place", 0);
    thirdPlace.is_third_place = true;
    sf1.loser_next_match_id = thirdPlace.id; sf1.loser_next_slot = 1;
    sf2.loser_next_match_id = thirdPlace.id; sf2.loser_next_slot = 2;
    roundMatches.push([thirdPlace]);
  }
  return { matches: roundMatches.flat() };
}
