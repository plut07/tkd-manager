import test from "node:test";
import assert from "node:assert/strict";
import { medalTable, placementsOf, isDecided, type Placement } from "../src/lib/medals";

/**
 * The medal table.
 *
 * Worth pinning because the ordering convention is the sort of thing that looks
 * arbitrary and is not: a single gold outranks any number of silvers, and
 * ranking on the total instead is a mistake nobody spots until a club that won
 * nothing is sitting at the top of the table.
 */

const clubs: Record<string, { key: string; name: string }> = {
  a1: { key: "kl", name: "KL Taekwon-Do" },
  a2: { key: "kl", name: "KL Taekwon-Do" },
  b1: { key: "pen", name: "Penang ITF" },
  b2: { key: "pen", name: "Penang ITF" },
  c1: { key: "joh", name: "Johor ITF" },
};
const groupOf = (id: string) => clubs[id] ?? null;

test("a podium becomes the placements it represents", () => {
  const out = placementsOf("cat1", { first: "a1", second: "b1", thirds: ["c1", "a2"] });
  assert.equal(out.length, 4);
  assert.deepEqual(out.map((p) => p.medal), ["gold", "silver", "bronze", "bronze"]);
  // Taekwon-Do awards two bronzes; both beaten semi-finalists take one.
  assert.deepEqual(out.filter((p) => p.medal === "bronze").map((p) => p.registrationId), ["c1", "a2"]);
});

test("a half-finished category contributes only what it has decided", () => {
  const out = placementsOf("cat1", { first: null, second: null, thirds: ["c1"] });
  assert.deepEqual(out.map((p) => p.medal), ["bronze"]);
  assert.equal(isDecided({ first: null, second: null, thirds: ["c1"] }), false);
  assert.equal(isDecided({ first: "a1", second: "b1", thirds: [] }), true);
});

test("one gold outranks any number of silvers", () => {
  const placements: Placement[] = [
    { categoryId: "c1", registrationId: "c1", medal: "gold" },
    { categoryId: "c2", registrationId: "a1", medal: "silver" },
    { categoryId: "c3", registrationId: "a2", medal: "silver" },
    { categoryId: "c4", registrationId: "a1", medal: "silver" },
  ];
  const table = medalTable(placements, groupOf);
  assert.equal(table[0].name, "Johor ITF");
  assert.equal(table[0].gold, 1);
  // KL has three medals to Johor's one, and still finishes second.
  assert.equal(table[1].name, "KL Taekwon-Do");
  assert.equal(table[1].total, 3);
});

test("silvers separate equal golds, and bronzes separate equal silvers", () => {
  const placements: Placement[] = [
    { categoryId: "c1", registrationId: "a1", medal: "gold" },
    { categoryId: "c2", registrationId: "b1", medal: "gold" },
    { categoryId: "c3", registrationId: "b2", medal: "silver" },
  ];
  const table = medalTable(placements, groupOf);
  assert.equal(table[0].name, "Penang ITF");
  assert.equal(table[1].name, "KL Taekwon-Do");
});

test("clubs level on all three share a rank, and the next is pushed past them", () => {
  const placements: Placement[] = [
    { categoryId: "c1", registrationId: "a1", medal: "gold" },
    { categoryId: "c2", registrationId: "b1", medal: "gold" },
    { categoryId: "c3", registrationId: "c1", medal: "bronze" },
  ];
  const table = medalTable(placements, groupOf);
  const byName = Object.fromEntries(table.map((r) => [r.name, r]));
  assert.equal(byName["KL Taekwon-Do"].rank, 1);
  assert.equal(byName["Penang ITF"].rank, 1);
  assert.equal(byName["KL Taekwon-Do"].tied, true);
  // Two firsts are followed by a third.
  assert.equal(byName["Johor ITF"].rank, 3);
  assert.equal(byName["Johor ITF"].tied, false);
});

test("medals from the same club are added together, not listed separately", () => {
  const placements: Placement[] = [
    { categoryId: "c1", registrationId: "a1", medal: "gold" },
    { categoryId: "c2", registrationId: "a2", medal: "gold" },
  ];
  const table = medalTable(placements, groupOf);
  assert.equal(table.length, 1);
  assert.equal(table[0].gold, 2);
});

test("a medallist whose club cannot be resolved is left out, not filed under nothing", () => {
  const placements: Placement[] = [
    { categoryId: "c1", registrationId: "a1", medal: "gold" },
    { categoryId: "c2", registrationId: "unknown", medal: "gold" },
  ];
  const table = medalTable(placements, groupOf);
  assert.equal(table.length, 1);
  assert.equal(table[0].name, "KL Taekwon-Do");
});

test("an event nobody has finished has an empty table rather than a broken one", () => {
  assert.deepEqual(medalTable([], groupOf), []);
});
