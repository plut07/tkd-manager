import test from "node:test";
import assert from "node:assert/strict";
import {
  boutOver,
  tally,
  decisionFor,
  judgeScore,
  judgeVerdict,
  penaltyTally,
  sideTotal,
  secondsLeft,
  formatClock,
  type Entry,
} from "../src/lib/scoreboard";

/**
 * The arithmetic that decides a bout.
 *
 * Everything under test here is deliberately plain -- no database, no clock of
 * its own, no React -- so it can be checked outright rather than by clicking
 * through a hall's worth of screens. These are the numbers a competitor is
 * beaten by, and the one part of this app where being quietly wrong matters
 * more than being broken.
 */

const NOW = Date.parse("2026-01-01T12:00:00Z");
const startedAgo = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

const point = (judge: number, side: "red" | "blue", value: number): Entry => ({
  judge_slot: judge,
  side,
  kind: "point",
  value,
});
const referee = (side: "red" | "blue", kind: "warning" | "penalty" | "decision"): Entry => ({
  judge_slot: 0,
  side,
  kind,
  value: 0,
});

// ---------------------------------------------------------------- the clock

test("a bout is not over before it has started", () => {
  assert.equal(boutOver({ state: "idle", startedAt: null, remaining: 120, currentRound: 1, rounds: 2 }, NOW), false);
  assert.equal(
    boutOver({ state: "running", startedAt: startedAgo(0), remaining: 120, currentRound: 1, rounds: 2 }, NOW),
    false,
  );
});

test("an early round running out is not the end of the bout", () => {
  assert.equal(
    boutOver({ state: "running", startedAt: startedAgo(200), remaining: 120, currentRound: 1, rounds: 2 }, NOW),
    false,
  );
});

test("the final round running out ends the bout", () => {
  assert.equal(
    boutOver({ state: "running", startedAt: startedAgo(200), remaining: 120, currentRound: 2, rounds: 2 }, NOW),
    true,
  );
});

test("a ring whose stored clock reads zero but has not started is not over", () => {
  // The live clock_remaining column is `not null default 0`, so a freshly
  // created ring carries a zero rather than the null the migration file
  // implies. Nothing may read that as time up: the state says it never began.
  assert.equal(boutOver({ state: "idle", startedAt: null, remaining: 0, currentRound: 1, rounds: 1 }, NOW), false);
});

test("between rounds the clock reads zero but the bout continues", () => {
  // Next round resets to idle with a full clock; a stopped clock on its own
  // must never be read as the end.
  assert.equal(boutOver({ state: "idle", startedAt: null, remaining: 120, currentRound: 2, rounds: 2 }, NOW), false);
  assert.equal(boutOver({ state: "idle", startedAt: null, remaining: 0, currentRound: 2, rounds: 2 }, NOW), false);
});

test("a pause mid-round is not the end, a pause at zero is", () => {
  assert.equal(boutOver({ state: "paused", startedAt: null, remaining: 45, currentRound: 2, rounds: 2 }, NOW), false);
  assert.equal(boutOver({ state: "paused", startedAt: null, remaining: 0, currentRound: 2, rounds: 2 }, NOW), true);
});

test("the countdown never exceeds what was on the clock", () => {
  // A device whose clock is behind the server's would otherwise be shown more
  // time than the round has.
  assert.equal(secondsLeft({ state: "running", startedAt: startedAgo(-30), remaining: 120 }, NOW), 120);
});

test("the clock shows a tenth only in the last ten seconds", () => {
  assert.equal(formatClock(95), "1:35");
  assert.equal(formatClock(9.4, true), "0:09.4");
  assert.equal(formatClock(9.4, false), "0:09");
});

// -------------------------------------------------------------- the verdict

test("the majority of judges decides the bout", () => {
  const entries = [point(1, "red", 3), point(2, "red", 2), point(3, "blue", 1)];
  assert.deepEqual(tally(entries, 3, "sparring", 10), {
    red: 2,
    blue: 1,
    undecided: 0,
    winner: "red",
    byDecision: false,
  });
});

test("judges who have not separated them count as undecided, not as a vote", () => {
  const entries = [point(1, "red", 2), point(2, "red", 1), point(2, "blue", 1)];
  const result = tally(entries, 3, "sparring", 10);
  assert.equal(result.red, 1);
  assert.equal(result.undecided, 2);
});

test("a level bout has no winner until somebody settles it", () => {
  const level = [point(1, "red", 2), point(2, "blue", 2)];
  assert.equal(tally(level, 2, "sparring", 10).winner, null);
  assert.equal(tally(level, 2, "sparring", 10).byDecision, false);
});

test("a superiority decision settles a level bout and says that it did", () => {
  const settled = [point(1, "red", 2), point(2, "blue", 2), referee("blue", "decision")];
  const result = tally(settled, 2, "sparring", 10);
  assert.equal(result.winner, "blue");
  assert.equal(result.byDecision, true);
});

test("a decision never overturns judges who have already separated them", () => {
  const clear = [point(1, "red", 3), point(2, "red", 2), point(3, "blue", 1), referee("blue", "decision")];
  assert.equal(tally(clear, 3, "sparring", 10).winner, "red");
});

test("the referee may change their mind; the last decision stands", () => {
  const entries = [referee("blue", "decision"), referee("red", "decision")];
  assert.equal(decisionFor(entries), "red");
});

test("a withdrawn decision leaves the bout level again", () => {
  const withdrawn = [referee("blue", "decision")].map((e) => ({ ...e, voided: true }));
  assert.equal(decisionFor(withdrawn), null);
});

// ------------------------------------------------------------- the penalties

test("three warnings cost a point, and a deduction costs one outright", () => {
  const warned = [referee("red", "warning"), referee("red", "warning")];
  assert.deepEqual(penaltyTally(warned, "red"), { warnings: 2, deductions: 0, points: 0 });

  const third = [...warned, referee("red", "warning")];
  assert.deepEqual(penaltyTally(third, "red"), { warnings: 3, deductions: 0, points: 1 });

  const fouled = [...third, referee("red", "penalty")];
  assert.equal(penaltyTally(fouled, "red").points, 2);
});

test("a referee's penalty comes off every judge's mark alike", () => {
  // It is a ruling on the bout, not one judge's opinion of it -- so it must
  // move the score without changing who each judge favours.
  const entries = [
    point(1, "red", 3),
    point(2, "red", 3),
    referee("red", "penalty"),
  ];
  assert.equal(judgeScore(entries, 1, "red", "sparring", 10), 2);
  assert.equal(judgeScore(entries, 2, "red", "sparring", 10), 2);
  assert.equal(judgeVerdict(entries, 1, "sparring", 10), "red");
});

test("a voided press counts for nothing", () => {
  const entries: Entry[] = [point(1, "red", 3), { ...point(1, "red", 2), voided: true }];
  assert.equal(judgeScore(entries, 1, "red", "sparring", 10), 3);
});

// ----------------------------------------------------------------- the modes

test("a pattern counts down from the mark the event set", () => {
  const entries: Entry[] = [
    { judge_slot: 1, side: "red", kind: "deduction", value: -0.5 },
    { judge_slot: 1, side: "red", kind: "deduction", value: -0.2 },
  ];
  assert.equal(judgeScore(entries, 1, "red", "pattern", 10), 9.3);
});

test("in flag mode only a judge's latest flag counts", () => {
  const entries: Entry[] = [
    { judge_slot: 1, side: "red", kind: "flag", value: 1 },
    { judge_slot: 1, side: "blue", kind: "flag", value: 1 },
  ];
  assert.equal(judgeVerdict(entries, 1, "flag", 0), "blue");
});

test("the headline figure averages the judges rather than summing them", () => {
  // Five judges scoring the same exchange would otherwise show five times the
  // points and mean nothing to the crowd.
  const entries = [point(1, "red", 3), point(2, "red", 3), point(3, "red", 3)];
  assert.equal(sideTotal(entries, 3, "red", "sparring", 10), 3);
});

test("flag mode shows the count of flags, which is the number that matters", () => {
  const entries: Entry[] = [
    { judge_slot: 1, side: "red", kind: "flag", value: 1 },
    { judge_slot: 2, side: "red", kind: "flag", value: 1 },
    { judge_slot: 3, side: "blue", kind: "flag", value: 1 },
  ];
  assert.equal(sideTotal(entries, 3, "red", "flag", 0), 2);
});
