import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { buildWorkbook, xlsxHeaders } from "@/lib/spreadsheet";
import { gradeLabel } from "@/lib/belts";
import { computeAge } from "@/lib/eligibility";

/**
 * Everyone registered for one event, with full details for checking against
 * the paperwork on grading day. Includes pending as well as confirmed entries,
 * with a Status column, so an organiser can see the whole picture in one sheet.
 */
export async function GET(request: NextRequest) {
  await requirePermission(PERMISSIONS.EVENT_VIEW);
  const eventId = request.nextUrl.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: event } = await supabase.from("events").select("name").eq("id", eventId).maybeSingle();
  const { data: regs } = await supabase
    .from("event_registrations")
    .select("status, competition_number, registered_at, clubs(name, country), students(first_name, last_name, email, birthday, gender, weight_kg, height_cm, gup, dan, nationality, national_id, passport_id)")
    .eq("event_id", eventId)
    .order("registered_at");

  const headers = [
    "Status", "No.", "Last name", "First name", "Club", "Club country",
    "Grade", "Gender", "Date of birth", "Age", "Weight (kg)", "Height (cm)",
    "Nationality", "ID number", "Passport ID", "Email", "Registered",
  ];

  const rows = (regs ?? []).map((r: any) => [
    r.status ?? "",
    r.competition_number ?? "",
    r.students?.last_name ?? "",
    r.students?.first_name ?? "",
    r.clubs?.name ?? "",
    r.clubs?.country ?? "",
    gradeLabel(r.students?.gup ?? null, r.students?.dan ?? null),
    r.students?.gender ?? "",
    r.students?.birthday ?? "",
    computeAge(r.students?.birthday ?? null) ?? "",
    r.students?.weight_kg ?? "",
    r.students?.height_cm ?? "",
    r.students?.nationality ?? "",
    r.students?.national_id ?? "",
    r.students?.passport_id ?? "",
    r.students?.email ?? "",
    r.registered_at ? String(r.registered_at).slice(0, 10) : "",
  ]);

  const safeName = (event?.name ?? "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const file = buildWorkbook(headers, rows, "Registrants");
  return new NextResponse(new Uint8Array(file), { headers: xlsxHeaders(`${safeName}-registrants.xlsx`) });
}
