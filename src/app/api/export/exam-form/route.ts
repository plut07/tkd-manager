import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { downloadTemplate, fillTemplate } from "@/lib/pdfTemplates";
import { type TemplateData } from "@/lib/templateFields";
import { componentsFor, syllabusFor, parseSheet, DEFAULT_SHEET, sheetTotal, type SheetComponent, type SheetMarks } from "@/lib/gradingSheet";
import { parseGradeText, gradeValue } from "@/lib/belts";
import { PDFDocument } from "pdf-lib";

export const dynamic = "force-dynamic";

/**
 * The exam result form as a PDF.
 *
 * ?registrationId=... for one candidate, or ?eventId=... for everyone marked,
 * one copy each, so an examiner can print the set in one go.
 *
 * The event's default result template supplies the layout; the marks come from
 * whatever has been saved, so a form printed mid-exam shows the marks so far
 * rather than refusing.
 */
export async function GET(request: NextRequest) {
  await requirePermission(PERMISSIONS.EVENT_VIEW);
  const registrationId = request.nextUrl.searchParams.get("registrationId");
  const eventIdParam = request.nextUrl.searchParams.get("eventId");
  const disposition = request.nextUrl.searchParams.get("download") ? "attachment" : "inline";
  if (!registrationId && !eventIdParam) {
    return NextResponse.json({ error: "Pass registrationId or eventId" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const select =
    "id, event_id, competition_number, clubs(name, instructor_name), event_categories(name, exam_events), students(full_name, birthday, gender, gup, dan, national_id, email, nationality, weight_kg, height_cm)";

  let rows: any[] = [];
  let eventId = eventIdParam;

  if (registrationId) {
    const { data } = await supabase.from("event_registrations").select(select).eq("id", registrationId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    rows = [data];
    eventId = data.event_id;
  } else {
    const { data } = await supabase.from("event_registrations").select(select).eq("event_id", eventIdParam).order("competition_number");
    rows = data ?? [];
  }

  const { data: event } = await supabase
    .from("events")
    .select("name, venue, venue_address, country, start_date, end_date, clubs:organizer_club_id(name)")
    .eq("id", eventId as string)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { data: templates } = await supabase
    .from("event_form_templates")
    .select("id, storage_path, offset_x, offset_y, scale, grades, is_default, created_at")
    .eq("event_id", eventId as string)
    .eq("purpose", "exam")
    .order("created_at");
  if (!templates || templates.length === 0) {
    return NextResponse.json(
      { error: "No result form has been set up for this event. Upload one on the Exam page." },
      { status: 400 },
    );
  }

  /**
   * The form a candidate prints on: one naming their grade, else the default,
   * else whatever exists. Grade wins over default so a rank-specific form is
   * never overridden by a general one.
   */
  const templateForGrade = (grade: string | null) => {
    const named = grade ? templates.find((t: any) => (t.grades ?? []).includes(grade)) : null;
    return named ?? templates.find((t: any) => t.is_default) ?? templates[0];
  };

  // Each rank can be marked on its own syllabus, so the sheet is resolved per
  // candidate rather than once for the event.
  const { data: syllabusRows } = await supabase
    .from("exam_syllabus")
    .select("grade_value, sheet")
    .eq("event_id", eventId as string);
  const byGrade: Record<string, SheetComponent[]> = {};
  let fallback = DEFAULT_SHEET;
  for (const row of syllabusRows ?? []) {
    if (row.grade_value) byGrade[row.grade_value] = parseSheet(row.sheet);
    else fallback = parseSheet(row.sheet);
  }
  const syllabusSet = { byGrade, fallback };
  const gradeCodeFor = (r: any) => {
    const g = parseGradeText(String(r?.event_categories?.name ?? ""));
    return gradeValue(g.gup, g.dan) || null;
  };

  const ids = rows.map((r) => r.id);
  let scores: any[] = [];
  if (ids.length > 0) {
    const { data } = await supabase.from("grading_exam_scores").select("*").in("registration_id", ids);
    scores = data ?? [];
  }
  const scoreByReg = new Map(scores.map((s: any) => [s.registration_id, s]));

  // Printing the whole event means the marked candidates; printing one means
  // that one, marked or not.
  const printable = registrationId ? rows : rows.filter((r) => scoreByReg.has(r.id));
  if (printable.length === 0) {
    return NextResponse.json({ error: "Nobody has been marked yet." }, { status: 400 });
  }

  const eventInfo = {
    name: (event as any).name,
    organizer: (event as any).clubs?.name ?? null,
    venue: (event as any).venue ?? null,
    venueAddress: (event as any).venue_address ?? null,
    country: (event as any).country ?? null,
    startDate: (event as any).start_date ?? null,
    endDate: (event as any).end_date ?? null,
  };

  const gradeCodes = printable.map(gradeCodeFor);

  const data: TemplateData[] = printable.map((r, i) => {
    const score = scoreByReg.get(r.id);
    const marks = (score?.marks ?? {}) as SheetMarks;
    const sheet = syllabusFor(syllabusSet, gradeCodes[i]);
    const components = componentsFor((r.event_categories?.exam_events as string[] | null) ?? [], sheet);
    return {
      participant: {
        fullName: r.students?.full_name ?? null,
        nationalId: r.students?.national_id ?? null,
        birthday: r.students?.birthday ?? null,
        gender: r.students?.gender ?? null,
        clubName: r.clubs?.name ?? null,
        instructor: r.clubs?.instructor_name ?? null,
        gup: r.students?.gup ?? null,
        dan: r.students?.dan ?? null,
        email: r.students?.email ?? null,
        nationality: r.students?.nationality ?? null,
        weightKg: r.students?.weight_kg ?? null,
        heightCm: r.students?.height_cm ?? null,
      },
      event: eventInfo,
      exam: {
        sheet,
        components,
        marks,
        total: score?.total != null ? Number(score.total) : sheetTotal(marks, components),
        passed: score?.passed === true,
        approvedRank: score?.approved_rank ?? r.event_categories?.name ?? null,
        remark: score?.remark ?? null,
        examinerName: score?.examiner_name ?? null,
        examinerSignature: score?.examiner_signature ?? null,
      },
    };
  });

  // Candidates on different forms are printed in separate passes and the pages
  // joined, so one download covers a mixed set of ranks.
  const byTemplate = new Map<string, { template: any; rows: TemplateData[] }>();
  data.forEach((row, i) => {
    const grade = gradeCodes[i];
    const t = templateForGrade(grade);
    const bucket = byTemplate.get(t.id) ?? { template: t, rows: [] };
    bucket.rows.push(row);
    byTemplate.set(t.id, bucket);
  });

  const merged = await PDFDocument.create();
  for (const { template, rows: forThisForm } of Array.from(byTemplate.values())) {
    const { data: fields } = await supabase
      .from("event_form_fields")
      .select("field_key, page, x, y, width, height, font_size, align")
      .eq("template_id", template.id);

    const bytes = await downloadTemplate(template.storage_path);
    const filled = await fillTemplate(bytes, (fields ?? []) as any, forThisForm, {
      offsetX: Number(template.offset_x) || 0,
      offsetY: Number(template.offset_y) || 0,
      scale: Number(template.scale) || 1,
    });
    const part = await PDFDocument.load(filled);
    const pages = await merged.copyPages(part, part.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  const filled = await merged.save();

  const who = registrationId ? (printable[0]?.students?.full_name ?? "") : "all-candidates";
  const filename = `result-${(who || "form").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;

  return new NextResponse(new Uint8Array(filled), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
