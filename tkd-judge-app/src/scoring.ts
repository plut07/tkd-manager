/**
 * Scoring, copied from the web app's src/lib/scoreboard.ts.
 *
 * A copy rather than a shared package, because the two projects build
 * separately and a private npm package would be a whole release process for
 * two hundred lines of arithmetic. The trade is that a change to the rules has
 * to be made twice — so this file is kept deliberately small, and the app never
 * decides a result: the server tallies the bout, and this only draws what the
 * judge's own pad should show.
 *
 * If the rules do change, the source of truth is the web file, and this one
 * should be replaced from it wholesale rather than edited.
 */

export type Side = "red" | "blue";
export type ScoreMode = "pattern" | "sparring" | "flag";
export type RingState = "idle" | "running" | "paused" | "finished";

export const SPARRING_BUTTONS = [3, 2, 1, -1, -2, -3];
export const PATTERN_BUTTONS = [-0.2, -0.5, -1];
export const WARNINGS_PER_POINT = 3;

export type Entry = {
  judge_slot: number;
  side: Side;
  kind: "point" | "deduction" | "flag" | "warning" | "penalty";
  value: number;
  round?: number;
  voided?: boolean;
};

const live = (entries: Entry[]) => entries.filter((e) => !e.voided);

export function penaltyTally(entries: Entry[], side: Side) {
  const against = live(entries).filter((e) => e.side === side && e.judge_slot === 0);
  const warnings = against.filter((e) => e.kind === "warning").length;
  const deductions = against.filter((e) => e.kind === "penalty").length;
  return { warnings, deductions, points: Math.floor(warnings / WARNINGS_PER_POINT) + deductions };
}

export function judgeScore(entries: Entry[], judge: number, side: Side, mode: ScoreMode, base: number): number {
  const mine = live(entries).filter((e) => e.judge_slot === judge && e.side === side);
  if (mode === "flag") return mine.some((e) => e.kind === "flag") ? 1 : 0;
  const sum = mine.reduce((total, e) => total + Number(e.value), 0);
  const score = mode === "pattern" ? base + sum : sum;
  return Math.round((score - penaltyTally(entries, side).points) * 100) / 100;
}

export function judgeVerdict(entries: Entry[], judge: number, mode: ScoreMode, base: number): Side | null {
  if (mode === "flag") {
    const flags = live(entries).filter((e) => e.judge_slot === judge && e.kind === "flag");
    return flags.length > 0 ? flags[flags.length - 1].side : null;
  }
  const red = judgeScore(entries, judge, "red", mode, base);
  const blue = judgeScore(entries, judge, "blue", mode, base);
  if (red === blue) return null;
  return red > blue ? "red" : "blue";
}

export function judgeHistory(entries: Entry[], judge: number): Entry[] {
  return live(entries)
    .filter((e) => e.judge_slot === judge)
    .slice()
    .reverse();
}

export type Clock = { state: RingState; startedAt: string | null; remaining: number };

export function secondsLeft(clock: Clock, now: number = Date.now()): number {
  if (clock.state !== "running" || !clock.startedAt) return Math.max(0, clock.remaining);
  const elapsed = (now - new Date(clock.startedAt).getTime()) / 1000;
  return Math.max(0, Math.round(clock.remaining - elapsed));
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}
