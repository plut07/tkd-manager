import "server-only";
// The default export reads *every* sheet and returns a list of them; the named
// `readSheet` reads one and returns its rows, which is what this wants.
// Aliased because this module exports a `readSheet` of its own.
import { readSheet as readOneSheet } from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";

/**
 * Thin wrapper over the spreadsheet library so the rest of the app never
 * touches it directly. Everything here runs on the server — the browser only
 * receives finished files.
 *
 * That wrapper earned its keep. This was SheetJS (`xlsx`), which carries an
 * unfixed prototype-pollution advisory and an unfixed ReDoS: no patched version
 * exists on npm, because SheetJS moved distribution to their own CDN and the
 * npm package was left where it was. Since the one thing this file does is
 * parse spreadsheets that arrive from a form, that was the one advisory in the
 * project with a real path to it.
 *
 * Swapping it touched only this file — three exported functions in, three out.
 *
 * read-excel-file and write-excel-file were chosen over exceljs, which is the
 * better-known alternative: exceljs pulls 104 packages and had two moderate
 * advisories of its own through `uuid`, and this pair pulls 8 and had none.
 * Replacing one vulnerable dependency with another is not a fix.
 */

export type SheetRow = Record<string, string>;

/**
 * Read the first sheet of an uploaded workbook into plain string rows keyed by
 * the header above them.
 *
 * Values are stringified and trimmed so validation deals with one shape only —
 * Excel otherwise hands back numbers, dates, booleans and formula results.
 * rowNumber is the real spreadsheet line (header is row 1), so error messages
 * point at what the user actually sees in Excel.
 */
export async function readSheet(
  buffer: ArrayBuffer,
): Promise<{ rows: SheetRow[]; rowNumbers: number[]; headers: string[] }> {
  // Reads the first sheet by default, which is what this has always done.
  const grid = (await readOneSheet(Buffer.from(buffer))) as unknown[][];
  if (grid.length === 0) return { rows: [], rowNumbers: [], headers: [] };

  const headers = (grid[0] ?? []).map((h) => String(h ?? "").trim());
  const rows: SheetRow[] = [];
  const rowNumbers: number[] = [];

  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i] ?? [];
    const row: SheetRow = {};
    let hasValue = false;
    headers.forEach((h, c) => {
      const v = cells[c];
      const value = v instanceof Date ? toISODate(v) : String(v ?? "").trim();
      if (h) row[h] = value;
      if (value) hasValue = true;
    });
    // A row of nothing but empty cells is a spacer, not an entry.
    if (hasValue) {
      rows.push(row);
      rowNumbers.push(i + 1); // grid index 1 == spreadsheet row 2
    }
  }
  return { rows, rowNumbers, headers };
}

/** Excel dates arrive as Date objects; store them as plain YYYY-MM-DD. */
function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Build an .xlsx file from a header row plus rows of plain values. */
export async function buildWorkbook(
  headers: string[],
  rows: (string | number | null)[][],
  sheetName = "Sheet1",
): Promise<Buffer> {
  // Every cell written as a string, as before: these files are read by people
  // and by this app's own importer, and a column that is text in one row and a
  // number in the next is how a competition number like "007" becomes 7.
  const data = [
    headers.map((h) => ({ value: h, fontWeight: "bold" as const })),
    ...rows.map((r) => r.map((c) => ({ value: c == null ? "" : String(c) }))),
  ];

  const columns = headers.map((h) => ({ width: Math.min(Math.max(h.length + 4, 12), 40) }));

  return writeXlsxFile(data, { sheet: sheetName, columns }).toBuffer();
}

/** Standard headers for returning a generated file from a route handler. */
export function xlsxHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };
}
