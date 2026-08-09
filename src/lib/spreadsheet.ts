import "server-only";
import * as XLSX from "xlsx";

/**
 * Thin wrapper over SheetJS so the rest of the app never touches it directly.
 * Everything here runs on the server — the browser only receives finished files.
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
export function readSheet(buffer: ArrayBuffer): { rows: SheetRow[]; rowNumbers: number[]; headers: string[] } {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], rowNumbers: [], headers: [] };
  const sheet = wb.Sheets[sheetName];

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, raw: false });
  if (grid.length === 0) return { rows: [], rowNumbers: [], headers: [] };

  const headers = (grid[0] as unknown[]).map((h) => String(h ?? "").trim());
  const rows: SheetRow[] = [];
  const rowNumbers: number[] = [];

  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i] as unknown[];
    const row: SheetRow = {};
    let hasValue = false;
    headers.forEach((h, c) => {
      const v = cells?.[c];
      const value = v instanceof Date ? toISODate(v) : String(v ?? "").trim();
      if (h) row[h] = value;
      if (value) hasValue = true;
    });
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
export function buildWorkbook(headers: string[], rows: (string | number | null)[][], sheetName = "Sheet1"): Buffer {
  const data = [headers, ...rows.map((r) => r.map((c) => (c == null ? "" : c)))];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = headers.map((h) => ({ wch: Math.min(Math.max(h.length + 4, 12), 40) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Standard headers for returning a generated file from a route handler. */
export function xlsxHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };
}
