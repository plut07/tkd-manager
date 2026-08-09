import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/authz";
import { buildWorkbook, xlsxHeaders } from "@/lib/spreadsheet";

/**
 * Turns the errors from an import preview into a spreadsheet, so a long list
 * can be worked through offline. Posted from the preview screen rather than
 * stored anywhere.
 */
export async function POST(request: NextRequest) {
  await requireSession();
  const form = await request.formData();
  let errors: { row: number; column: string; value: string; problem: string }[] = [];
  try {
    errors = JSON.parse(String(form.get("errors") || "[]"));
  } catch {
    errors = [];
  }
  const rows = errors.map((e) => [e.row, e.column, e.value, e.problem]);
  const file = buildWorkbook(["Spreadsheet row", "Column", "Value", "Problem"], rows, "Errors");
  return new NextResponse(new Uint8Array(file), { headers: xlsxHeaders("import-errors.xlsx") });
}
