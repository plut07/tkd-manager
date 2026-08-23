/**
 * Live scoreboard scoring.
 *
 * Three modes, one shape: five judges each reach their own verdict, and the
 * majority decides the bout.
 *
 *   sparring  judges add and subtract points  (+3 +2 +1 / -1 -2 -3)
 *   pattern   judges start at a set mark and deduct  (-0.2 -0.5 -1)
 *   flag      judges simply pick a side
 *
 * Totals are always derived from the individual presses rather than kept as a
 * running number, so an undo is one row marked void and a disputed bout can be
 * recounted press by press.
 *
 * Deliberately plain -- no server-only or database imports -- so the same
 * arithmetic runs on the judge's phone, the display, the server, and later the
 * Android build.
 */

export type Side = "red" | "blue";
export type ScoreMode = "pattern" | "sparring" | "flag";
export type RingState = "idle" | "running" | "paused" | "finished";

export const MODES: { value: ScoreMode; label: string; note: string }[] = [
  { value: "sparring", label: "Sparring", note: "Judges add and take away points as the bout runs." },
  { value: "pattern", label: "Pattern", note: "Judges start at the set mark and deduct for faults." },
  { value: "flag", label: "Flag", note: "Judges pick a winner. No points." },
];

/** The buttons a judge sees, per mode. */
export const SPARRING_BUTTONS = [3, 2, 1, -1, -2, -3];
export const PATTERN_BUTTONS = [-0.2, -0.5, -1];

/**
 * The twenty-four ITF patterns, in syllabus order.
 *
 * Listed lowest grade first, the way a competitor learns them, so the ring
 * official picking one scrolls in the direction they're already thinking.
 */
export const PATTERNS = [
  "Chon-Ji", "Dan-Gun", "Do-San", "Won-Hyo", "Yul-Gok", "Joong-Gun",
  "Toi-Gye", "Hwa-Rang", "Choong-Moo", "Kwang-Gae", "Po-Eun", "Ge-Baek",
  "Eui-Am", "Choong-Jang", "Juche", "Sam-Il", "Yoo-Sin", "Choi-Yong",
  "Yong-Gae", "Ul-Ji", "Moon-Moo", "So-San", "Se-Jong", "Tong-Il",
] as const;

/**
 * Three warnings make a point.
 *
 * The referee calls warnings and deductions; the judges never touch them. A
 * deduction takes a point off straight away, and every third warning does the
 * same, so the two are counted separately and converted at the end.
 */
export const WARNINGS_PER_POINT = 3;

export type Entry = {
  /** 1..judgeCount for a judge; 0 for the referee's warnings and deductions. */
  judge_slot: number;
  side: Side;
  kind: "point" | "deduction" | "flag" | "warning" | "penalty";
  value: number;
  round?: number;
  voided?: boolean;
};

const live = (entries: Entry[]) => entries.filter((e) => !e.voided);

/** The referee's count against one side, and what it costs them. */
export function penaltyTally(
  entries: Entry[],
  side: Side,
): { warnings: number; deductions: number; points: number } {
  const against = live(entries).filter((e) => e.side === side && e.judge_slot === 0);
  const warnings = against.filter((e) => e.kind === "warning").length;
  const deductions = against.filter((e) => e.kind === "penalty").length;
  return { warnings, deductions, points: Math.floor(warnings / WARNINGS_PER_POINT) + deductions };
}

/**
 * One judge's mark for one side.
 *
 * Referee penalties come off every judge's mark equally — they are the
 * referee's ruling on the bout, not one judge's opinion of it — so a deduction
 * moves the score without changing who each judge favours.
 */
export function judgeScore(entries: Entry[], judge: number, side: Side, mode: ScoreMode, base: number): number {
  const mine = live(entries).filter((e) => e.judge_slot === judge && e.side === side);
  if (mode === "flag") return mine.some((e) => e.kind === "flag") ? 1 : 0;
  const sum = mine.reduce((total, e) => total + Number(e.value), 0);
  // Pattern counts down from the mark the event set; sparring counts up from nothing.
  const score = mode === "pattern" ? base + sum : sum;
  return Math.round((score - penaltyTally(entries, side).points) * 100) / 100;
}

/** Which side a judge favours, or null when they haven't separated them. */
export function judgeVerdict(entries: Entry[], judge: number, mode: ScoreMode, base: number): Side | null {
  if (mode === "flag") {
    // A judge may change their mind; the last flag they raised is the one that counts.
    const flags = live(entries).filter((e) => e.judge_slot === judge && e.kind === "flag");
    return flags.length > 0 ? flags[flags.length - 1].side : null;
  }
  const red = judgeScore(entries, judge, "red", mode, base);
  const blue = judgeScore(entries, judge, "blue", mode, base);
  if (red === blue) return null;
  return red > blue ? "red" : "blue";
}

/** How many judges favour each side, and who that makes the winner. */
export function tally(
  entries: Entry[],
  judgeCount: number,
  mode: ScoreMode,
  base: number,
): { red: number; blue: number; undecided: number; winner: Side | null } {
  let red = 0;
  let blue = 0;
  let undecided = 0;
  for (let judge = 1; judge <= judgeCount; judge++) {
    const verdict = judgeVerdict(entries, judge, mode, base);
    if (verdict === "red") red++;
    else if (verdict === "blue") blue++;
    else undecided++;
  }
  // A tie is a tie: it stays undecided rather than being broken silently, so a
  // referee has to make the call.
  const winner = red === blue ? null : red > blue ? "red" : "blue";
  return { red, blue, undecided, winner };
}

/**
 * The headline figure for a side.
 *
 * The average across judges, because five judges scoring the same exchange
 * would otherwise show five times the points and mean nothing to the crowd.
 * Flag mode shows the count of flags instead, which is the number that matters.
 */
export function sideTotal(entries: Entry[], judgeCount: number, side: Side, mode: ScoreMode, base: number): number {
  if (mode === "flag") {
    let flags = 0;
    for (let judge = 1; judge <= judgeCount; judge++) if (judgeVerdict(entries, judge, mode, base) === side) flags++;
    return flags;
  }
  let sum = 0;
  for (let judge = 1; judge <= judgeCount; judge++) sum += judgeScore(entries, judge, side, mode, base);
  const average = judgeCount > 0 ? sum / judgeCount : 0;
  // Patterns are marked to a decimal; sparring points are whole.
  return mode === "pattern" ? Math.round(average * 100) / 100 : Math.round(average);
}

/** What a judge has pressed, newest first, so they can take one back. */
export function judgeHistory(entries: Entry[], judge: number): Entry[] {
  return live(entries)
    .filter((e) => e.judge_slot === judge)
    .slice()
    .reverse();
}

// ---------------------------------------------------------------- the clock

export type Clock = { state: RingState; startedAt: string | null; remaining: number };

/**
 * Seconds left, worked out from when the clock was started.
 *
 * Every screen calculates this itself from one instant, rather than the server
 * broadcasting a tick each second -- that would be constant traffic and would
 * still drift between devices.
 */
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

/** A short, unambiguous code judges can type in: no O/0 or I/1 to mistake. */
export function makeJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}
