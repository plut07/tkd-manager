import { NextResponse } from "next/server";
import { requirePermission, clubScope } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { buildWorkbook, xlsxHeaders } from "@/lib/spreadsheet";
import { STUDENT_COLUMNS } from "@/lib/importSpecs";
import { gradeLabel } from "@/lib/belts";

// Club Users get their own club only, matching what they see on screen.
export async function GET() {
  const session = await requirePermission(PERMISSIONS.STUDENT_VIEW);
  const supabase = supabaseAdmin();
  const scope = clubScope(session);

  let query = supabase
    .from("students")
    .select("first_name, last_name, email, birthday, gender, weight_kg, height_cm, gup, dan, nationality, national_id, club_number, active, clubs(name)")
    .order("last_name");
  if (scope) query = query.eq("club_id", scope);
  const { data } = await query;

  const rows = (data ?? []).map((s: any) => [
    s.clubs?.name ?? "",
    s.first_name ?? "",
    s.last_name ?? "",
    s.email ?? "",
    s.birthday ?? "",
    s.gender ?? "",
    s.weight_kg ?? "",
    s.height_cm ?? "",
    gradeLabel(s.gup ?? null, s.dan ?? null).replace(" (Black belt)", ""),
    s.nationality ?? "",
    s.national_id ?? "",
    s.active ? "yes" : "no",
  ]);

  const file = buildWorkbook(STUDENT_COLUMNS.map((c) => c.header), rows, "Students");
  return new NextResponse(new Uint8Array(file), { headers: xlsxHeaders(`students-${new Date().toISOString().slice(0, 10)}.xlsx`) });
}
