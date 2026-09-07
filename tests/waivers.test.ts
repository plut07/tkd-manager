import test from "node:test";
import assert from "node:assert/strict";
import { signatureList, individualSignature, isSigned, signatureSummary } from "../src/lib/waivers";

/**
 * Reading waiver signatures.
 *
 * Worth pinning because the failure mode here is silent and backwards. These
 * used to come back as one object or null, and every screen wrote
 * `r.waiver_signatures ? "Signed" : "Not signed"`. Team entries collect one
 * signature per member, so the unique constraint went -- and PostgREST began
 * returning an array. An empty array is truthy, so the moment that happened
 * every unsigned entry would have started reporting itself as signed.
 */

const individual = { student_id: null, signed_name: "TAN WEI MING", signed_at: "2026-09-01T10:00:00Z" };
const member = (id: string, name: string) => ({ student_id: id, signed_name: name, signed_at: "2026-09-01T10:00:00Z" });

test("an empty embed is not a signature, however it arrives", () => {
  // The whole point: [] is truthy, and this must not be.
  assert.equal(isSigned([], false), false);
  assert.equal(isSigned(null, false), false);
  assert.equal(isSigned(undefined, false), false);
  assert.deepEqual(signatureList([]), []);
});

test("both shapes of embed read the same", () => {
  // Older queries returned an object; the same data as a one-element array
  // must mean the same thing.
  assert.equal(signatureList(individual).length, 1);
  assert.equal(signatureList([individual]).length, 1);
  assert.equal(isSigned(individual, false), true);
  assert.equal(isSigned([individual], false), true);
});

test("an individual's signature is the row with no member against it", () => {
  assert.equal(individualSignature([individual])?.signed_name, "TAN WEI MING");
  // A team's rows all name a member; none of them is the entry's own signature.
  assert.equal(individualSignature([member("s1", "A"), member("s2", "B")]), null);
});

test("a team is signed only when every member on the sheet has signed", () => {
  const two = [member("s1", "A"), member("s2", "B")];
  assert.equal(isSigned(two, true, 3), false);
  assert.equal(isSigned(two, true, 2), true);
});

test("a team with nobody on its sheet is not signed, whatever rows exist", () => {
  // Otherwise an empty team would report complete on a vacuous truth.
  assert.equal(isSigned([], true, 0), false);
  assert.equal(isSigned([member("s1", "A")], true, 0), false);
});

test("an individual's rows are not satisfied by a member signature", () => {
  assert.equal(isSigned([member("s1", "A")], false), false);
});

test("the summary says what is missing rather than just yes or no", () => {
  assert.equal(signatureSummary([individual], false), "Signed by TAN WEI MING");
  assert.equal(signatureSummary([], false), "Not signed");
  assert.equal(signatureSummary([member("s1", "A")], true, 3), "1 of 3 signed");
});
