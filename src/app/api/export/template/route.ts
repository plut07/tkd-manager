import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/authz";
import { buildWorkbook, xlsxHeaders } from "@/lib/spreadsheet";
import { STUDENT_COLUMNS, CLUB_COLUMNS } from "@/lib/importSpecs";

/**
 * Blank import template: the exact headers the importer expects, one example
 * row, and a notes row explaining the fiddly columns. Users fill it in and
 * upload it back.
 */
export async function GET(request: NextRequest) {
  await requireSession();
  const kind = request.nextUrl.searchParams.get("kind") === "clubs" ? "clubs" : "students";
  const columns = kind === "clubs" ? CLUB_COLUMNS : STUDENT_COLUMNS;

  const example = columns.map((c) => c.example);
  const notes = columns.map((c) => (c.required ? `Required. ${c.note ?? ""}`.trim() : c.note ?? ""));

  const file = buildWorkbook(columns.map((c) => c.header), [example, notes], kind === "clubs" ? "Clubs" : "Students");
  return new NextResponse(new Uint8Array(file), { headers: xlsxHeaders(`${kind}-import-template.xlsx`) });
}
