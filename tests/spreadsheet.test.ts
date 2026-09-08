import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkbook, readSheet } from "../src/lib/spreadsheet";

/**
 * Reading and writing spreadsheets.
 *
 * These two functions were SheetJS until the advisory against it turned out to
 * have no patched version on npm. Swapping the library underneath them is
 * exactly the kind of change that looks fine, typechecks, builds, and then
 * mangles somebody's import of four hundred students.
 *
 * So: write a workbook, read it back, and check the values survived — including
 * the ones that spreadsheets are notorious for helpfully ruining.
 */

const bytes = (b: Buffer): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

test("a workbook written by this app can be read back by it", async () => {
  const file = await buildWorkbook(["Name", "Club", "Weight"], [
    ["TAN WEI MING", "KL Taekwon-Do", "63.5"],
    ["SITI NURHALIZA", "Penang ITF", "57"],
  ]);

  const { rows, headers, rowNumbers } = await readSheet(bytes(file));

  assert.deepEqual(headers, ["Name", "Club", "Weight"]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { Name: "TAN WEI MING", Club: "KL Taekwon-Do", Weight: "63.5" });
  // Header is spreadsheet row 1, so the first entry is row 2 — error messages
  // quote these back at people looking at Excel.
  assert.deepEqual(rowNumbers, [2, 3]);
});

test("a leading-zero identifier is not turned into a number", async () => {
  // The classic spreadsheet betrayal: competition number 007 coming back as 7,
  // or an NRIC losing its first digit. Everything is written as text for this
  // reason, and this is the test that says so.
  const file = await buildWorkbook(["Number", "NRIC"], [["007", "0123456A"]]);
  const { rows } = await readSheet(bytes(file));
  assert.equal(rows[0].Number, "007");
  assert.equal(rows[0].NRIC, "0123456A");
});

test("empty cells read as empty strings, not undefined", async () => {
  // Validation downstream does string work on every field; an undefined here
  // becomes "undefined" in somebody's record.
  const file = await buildWorkbook(["Name", "Email"], [["AHMAD FAIZAL", null]]);
  const { rows } = await readSheet(bytes(file));
  assert.equal(rows[0].Email, "");
  assert.equal(typeof rows[0].Email, "string");
});

test("a row of nothing at all is skipped rather than imported as blank", async () => {
  const file = await buildWorkbook(["Name", "Club"], [
    ["LEE CHONG WEI", "KL Taekwon-Do"],
    ["", ""],
    ["PRIYA DEVI", "Johor ITF"],
  ]);
  const { rows, rowNumbers } = await readSheet(bytes(file));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.Name), ["LEE CHONG WEI", "PRIYA DEVI"]);
  // The skipped spacer must not shift the numbering of what follows it.
  assert.deepEqual(rowNumbers, [2, 4]);
});

test("an empty workbook is empty rather than an error", async () => {
  const file = await buildWorkbook(["Name"], []);
  const { rows, headers } = await readSheet(bytes(file));
  assert.deepEqual(headers, ["Name"]);
  assert.deepEqual(rows, []);
});

test("values are trimmed, and headers too", async () => {
  const file = await buildWorkbook(["  Name  "], [["  TAN WEI MING  "]]);
  const { rows, headers } = await readSheet(bytes(file));
  assert.deepEqual(headers, ["Name"]);
  assert.equal(rows[0].Name, "TAN WEI MING");
});
