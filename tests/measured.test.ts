import test from "node:test";
import assert from "node:assert/strict";
import {
  bestAt,
  takenAt,
  standings,
  measuredKindOf,
  techniquesFor,
  SPECIAL_TECHNIQUES,
  POWER_TECHNIQUES,
  type Attempt,
} from "../src/lib/measured";

/**
 * Ranking the measured disciplines.
 *
 * Nobody faces anybody in a power test or a special technique, so there is no
 * bout to watch go wrong -- a mistake here surfaces as somebody standing on the
 * wrong step of a podium. Worth pinning outright.
 */

const attempt = (registrationId: string, technique: string, attemptNo: number, result: number, scored = true): Attempt => ({
  registrationId,
  technique,
  attemptNo,
  result,
  scored,
});

test("a competitor's mark at a technique is their best attempt, not their last", () => {
  const attempts = [
    attempt("a", "yop_chagi", 1, 3),
    attempt("a", "yop_chagi", 2, 5),
    attempt("a", "yop_chagi", 3, 2),
  ];
  assert.equal(bestAt(attempts, "a", "yop_chagi"), 5);
});

test("a missed attempt contributes nothing but does not drag the best down", () => {
  const attempts = [
    attempt("a", "yop_chagi", 1, 4),
    attempt("a", "yop_chagi", 2, 0, false),
  ];
  assert.equal(bestAt(attempts, "a", "yop_chagi"), 4);
  // It still counts as an attempt taken, which is what breaks a tie.
  assert.equal(takenAt(attempts, "a", "yop_chagi"), 2);
});

test("a technique nobody has attempted scores nothing", () => {
  assert.equal(bestAt([], "a", "yop_chagi"), 0);
  assert.equal(takenAt([], "a", "yop_chagi"), 0);
});

test("attempts belonging to another competitor are not counted", () => {
  const attempts = [attempt("a", "yop_chagi", 1, 3), attempt("b", "yop_chagi", 1, 9)];
  assert.equal(bestAt(attempts, "a", "yop_chagi"), 3);
});

test("the total adds the best of each technique", () => {
  const techniques = ["yop_chagi", "dollyo_chagi"];
  const attempts = [
    attempt("a", "yop_chagi", 1, 3),
    attempt("a", "yop_chagi", 2, 5),
    attempt("a", "dollyo_chagi", 1, 4),
  ];
  const [only] = standings(attempts, ["a"], techniques);
  assert.deepEqual(only.perTechnique, [5, 4]);
  assert.equal(only.total, 9);
});

test("the category is ranked on the total, highest first", () => {
  const techniques = ["yop_chagi"];
  const attempts = [
    attempt("a", "yop_chagi", 1, 3),
    attempt("b", "yop_chagi", 1, 6),
    attempt("c", "yop_chagi", 1, 4),
  ];
  const order = standings(attempts, ["a", "b", "c"], techniques).map((s) => s.registrationId);
  assert.deepEqual(order, ["b", "c", "a"]);
});

test("a tie on the total is broken by who needed fewer attempts", () => {
  // Both broke four boards; one did it first time.
  const techniques = ["yop_chagi"];
  const attempts = [
    attempt("slow", "yop_chagi", 1, 2),
    attempt("slow", "yop_chagi", 2, 3),
    attempt("slow", "yop_chagi", 3, 4),
    attempt("quick", "yop_chagi", 1, 4),
  ];
  const order = standings(attempts, ["slow", "quick"], techniques).map((s) => s.registrationId);
  assert.deepEqual(order, ["quick", "slow"]);
});

test("performances that cannot be separated share a place, and say so", () => {
  const techniques = ["yop_chagi"];
  const attempts = [
    attempt("a", "yop_chagi", 1, 4),
    attempt("b", "yop_chagi", 1, 4),
    attempt("c", "yop_chagi", 1, 2),
  ];
  const result = standings(attempts, ["a", "b", "c"], techniques);
  const byId = Object.fromEntries(result.map((s) => [s.registrationId, s]));

  assert.equal(byId.a.place, 1);
  assert.equal(byId.b.place, 1);
  assert.equal(byId.a.tied, true);
  assert.equal(byId.b.tied, true);
  // Two firsts are followed by a third, not by a second.
  assert.equal(byId.c.place, 3);
  assert.equal(byId.c.tied, false);
});

test("a competitor who has done nothing still appears, on nothing", () => {
  const result = standings([], ["a", "b"], ["yop_chagi"]);
  assert.equal(result.length, 2);
  assert.equal(result[0].total, 0);
  // Nobody has been separated, so nobody is ahead of anybody.
  assert.equal(result[0].place, 1);
  assert.equal(result[1].place, 1);
});

test("category types map to the discipline they actually are", () => {
  assert.equal(measuredKindOf("power_breaking"), "power_test");
  assert.equal(measuredKindOf("special_event"), "special_technique");
  assert.equal(measuredKindOf("sparring"), null);
  assert.equal(measuredKindOf(null), null);
});

test("each discipline offers its own techniques", () => {
  assert.equal(techniquesFor("special_technique"), SPECIAL_TECHNIQUES);
  assert.equal(techniquesFor("power_test"), POWER_TECHNIQUES);
  // The five ITF special techniques, all jumping kicks.
  assert.equal(SPECIAL_TECHNIQUES.length, 5);
});
