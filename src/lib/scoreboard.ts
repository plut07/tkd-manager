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

/**
 * The buttons a judge sees, per mode.
 *
 * An award carries the technique it is for, because a judge under pressure is
 * reading a button, not remembering a table. The values are the ITF ones:
 *
 *   1  hand attack to mid or high section; foot attack to mid section
 *   2  hand attack in the air to high section; jumping or flying kick to mid
 *      section; foot attack to high section
 *   3  jumping or flying kick to high section
 *
 * A correction is the same button with the sign turned round. ITF judges only
 * ever award, and Undo is the proper way to take a press back — but Undo only
 * reaches the *last* press, and a judge who notices a mistake three exchanges
 * later has nothing else. They are kept, and kept visibly apart from the
 * awards, so nobody mistakes one for an ITF deduction: a deduction is the
 * referee's call and is pressed on the operator's screen.
 */
export type ScoreButton = {
  value: number;
  /** What the button says. */
  label: string;
  /** What it is for, in the judge's words. */
  note: string;
};

export const SPARRING_AWARDS: ScoreButton[] = [
  { value: 1, label: "+1", note: "Hand to mid or high · foot to mid" },
  { value: 2, label: "+2", note: "Foot to high · jumping hand high · jumping kick to mid" },
  { value: 3, label: "+3", note: "Jumping or flying kick to high" },
];

export const SPARRING_CORRECTIONS: ScoreButton[] = [
  { value: -1, label: "−1", note: "Take back a 1" },
  { value: -2, label: "−2", note: "Take back a 2" },
  { value: -3, label: "−3", note: "Take back a 3" },
];

/** A pattern is marked down from the set base, fault by fault. */
export const PATTERN_DEDUCTIONS: ScoreButton[] = [
  { value: -0.2, label: "−0.2", note: "Minor fault" },
  { value: -0.5, label: "−0.5", note: "Clear fault" },
  { value: -1, label: "−1", note: "Major fault" },
];

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
  /** 1..judgeCount for a judge; 0 for the referee's warnings, deductions and decision. */
  judge_slot: number;
  side: Side;
  kind: "point" | "deduction" | "flag" | "warning" | "penalty" | "decision";
  value: number;
  round?: number;
  voided?: boolean;
  /**
   * The name the device gave this press, when it gave one.
   *
   * A pad that scored while the wifi was down holds its presses in a queue and
   * sends them when it comes back. Until the server confirms one it is drawn
   * from the queue, and once it is confirmed it arrives back here with the same
   * name — which is how the pad knows to stop drawing its own copy rather than
   * showing the press twice.
   */
  clientId?: string | null;
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

/**
 * The referee's superiority decision, if one has been given.
 *
 * ITF breaks a level bout with an extra round, and a bout still level after
 * that with a decision on superiority. This is that decision: the last one
 * given stands, so a referee can correct themselves.
 */
export function decisionFor(entries: Entry[]): Side | null {
  const calls = live(entries).filter((e) => e.judge_slot === 0 && e.kind === "decision");
  return calls.length > 0 ? calls[calls.length - 1].side : null;
}

/** How many judges favour each side, and who that makes the winner. */
export function tally(
  entries: Entry[],
  judgeCount: number,
  mode: ScoreMode,
  base: number,
): { red: number; blue: number; undecided: number; winner: Side | null; byDecision: boolean } {
  let red = 0;
  let blue = 0;
  let undecided = 0;
  for (let judge = 1; judge <= judgeCount; judge++) {
    const verdict = judgeVerdict(entries, judge, mode, base);
    if (verdict === "red") red++;
    else if (verdict === "blue") blue++;
    else undecided++;
  }
  if (red !== blue) return { red, blue, undecided, winner: red > blue ? "red" : "blue", byDecision: false };

  // Level. A tie is never broken silently — but once the referee has given a
  // superiority decision, that *is* the answer, and the result can be saved
  // without anybody editing a score to force it through.
  const decision = decisionFor(entries);
  return { red, blue, undecided, winner: decision, byDecision: decision !== null };
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
 *
 * `now` must be the *server's* idea of the time. The moment the clock was
 * started is written by the server, so measuring it against a laptop's own
 * clock measures the gap between the two machines as well as the elapsed time.
 * A hall laptop five seconds slow made a 120-second round start at 2:05 and
 * count down from there; see clockOffset.
 */
export function secondsLeft(clock: Clock, now: number = Date.now()): number {
  return Math.round(secondsLeftExact(clock, now));
}

/**
 * The same, unrounded.
 *
 * The rounded value is what gets stored and compared; this one is for the last
 * few seconds on a display, where a tenth is shown.
 */
export function secondsLeftExact(clock: Clock, now: number = Date.now()): number {
  if (clock.state !== "running" || !clock.startedAt) return Math.max(0, clock.remaining);
  const elapsed = (now - new Date(clock.startedAt).getTime()) / 1000;
  // Never above what was on the clock when it started: a device whose clock is
  // behind the server's would otherwise show more time than the round has.
  return Math.max(0, Math.min(clock.remaining, clock.remaining - elapsed));
}

/**
 * Whether the bout is over, worked out rather than looked up.
 *
 * "Finished" is a state somebody presses, and for a while nobody did: the last
 * round's time ran out, the display painted a winner, and the ring row still
 * said `running` — so a judge's pad kept taking presses and could move a result
 * the hall had already seen called.
 *
 * Time up on the final round is the end of the bout whether or not the operator
 * has got to the button yet, so both the display and the server derive it from
 * the same three facts: the clock, which round it is, and how many there are.
 *
 * `now` must be the server's idea of the time — see secondsLeftExact.
 */
export type BoutClock = Clock & { currentRound: number; rounds: number };

export function boutOver(bout: BoutClock, now: number = Date.now()): boolean {
  if (bout.state === "finished") return true;
  // Between rounds the clock reads 0:00 with the state back to idle. That is a
  // pause in the bout, not the end of it.
  if (bout.state === "idle") return false;
  if (bout.currentRound < bout.rounds) return false;
  return secondsLeftExact(bout, now) <= 0;
}

/**
 * How far this device's clock is from the server's, in milliseconds.
 *
 * Taken from a timestamp the server put in the same reply, so it costs no
 * extra request. Only ever an estimate — it also contains however long the
 * reply took to arrive — but that is tens of milliseconds against the seconds
 * or minutes a mis-set laptop is out by.
 */
export function clockOffset(serverNow: string | null | undefined, deviceNow: number = Date.now()): number {
  if (!serverNow) return 0;
  const server = new Date(serverNow).getTime();
  if (!Number.isFinite(server)) return 0;
  return server - deviceNow;
}

/** The server's time, as this device should count it. */
export function serverTime(offsetMs: number, deviceNow: number = Date.now()): number {
  return deviceNow + offsetMs;
}

/**
 * mm:ss, and under ten seconds mm:ss.t.
 *
 * The tenth only appears at the end, where a round is decided and people are
 * watching the number rather than the bout. Showing it the whole way through
 * makes a scoreboard restless to look at, and the digit changes too fast to
 * read anyway.
 */
export function formatClock(seconds: number, tenths: boolean = false): string {
  const safe = Math.max(0, seconds);
  if (tenths && safe < 10) {
    return `0:${safe.toFixed(1).padStart(4, "0")}`;
  }
  const whole = Math.floor(safe);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

/** A short, unambiguous code judges can type in: no O/0 or I/1 to mistake. */
export function makeJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}
