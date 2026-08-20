"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireSession } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { gradeLabel, nextGrade, gradeRank, parseGradeText, GRADE_OPTIONS } from "@/lib/belts";
import { computeAge } from "@/lib/eligibility";
import { effectiveEventStatus, canOverrideLocks } from "@/lib/eventStatus";
import {
  DEFAULT_SHEET,
  componentsFor,
  parseSheet,
  cleanMark,
  sheetTotal,
  marksSayPassed,
  selectedRows,
  REMARK_MAX,
  type SheetComponent,
  type SheetMarks,
} from "@/lib/gradingSheet";
import { ensureCategoryForTarget, syncGradingCategory } from "@/lib/gradingCategory";

/**
 * Marking a grading.
 *
 * Several examiners work the same event at once, each usually on different
 * candidates, so a save writes one candidate's sheet and nothing else. A locked
 * sheet is refused outright.
 */

export type ExamRowDto = {
  registrationId: string;
  competitionNumber: string | null;
  studentName: string;
  clubName: string | null;
  gender: string | null;
  age: number | null;
  currentGrade: string;
  targetGrade: string | null;
  categoryId: string | null;
  categoryName: string | null;
  /** Which components this candidate's category is marked on. */
  components: string[];
  status: string;
  marks: SheetMarks;
  remark: string;
  passed: boolean;
  total: number;
  approvedRank: string | null;
  examinerName: string | null;
  examinerSignature: string | null;
  locked: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type ExamSaveResult = { ok: true; row: ExamRowDto } | { error: string };

/**
 * A signed-out user's save throws Next's internal redirect, which must travel
 * up rather than be reported as "couldn't save".
 */
function isRedirect(e: unknown): boolean {
  return typeof e === "object" && e !== null && typeof (e as any).digest === "string" && (e as any).digest.startsWith("NEXT_REDIRECT");
}

/**
 * Marking stays open while the event is running and closes when it finishes,
 * matching the rest of the event. A Super Admin, or whoever created the event,
 * can still correct a result afterwards.
 */
async function assertCanMark(eventId: string) {
  const session = await requirePermission(PERMISSIONS.EVENT_EDIT);
  const supabase = supabaseAdmin();
  const { data: event } = await supabase
    .from("events")
    .select("id, start_date, end_date, status, created_by")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) throw new Error("Event not found.");
  const finished = effectiveEventStatus(event as any) === "completed";
  if (finished && !canOverrideLocks({ sub: session.sub, role: session.role }, event as any)) {
    throw new Error("This event has finished, so its marks can no longer be changed.");
  }
  return { session, supabase, event };
}

/** An event's own syllabus, or the built-in one when it hasn't set one. */
export async function loadSyllabus(eventId: string): Promise<SheetComponent[]> {
  const { data } = await supabaseAdmin().from("exam_syllabus").select("sheet").eq("event_id", eventId).maybeSingle();
  return data ? parseSheet(data.sheet) : DEFAULT_SHEET;
}

/**
 * Keep only marks the sheet knows about, each inside its row's range.
 *
 * The browser sends whatever it likes, so nothing here trusts the shape: a
 * chosen pattern that isn't on the syllabus, or a mark above its ceiling, is
 * dropped rather than stored.
 */
function cleanMarks(input: SheetMarks, sheet: SheetComponent[]): SheetMarks {
  const out: SheetMarks = {};
  for (const component of sheet) {
    if (component.kind === "select") {
      const allowed = new Set(component.items.map((i) => i.key));
      const rows = selectedRows(input, component)
        .filter((r) => allowed.has(r.item))
        .map((r) => ({ item: r.item, score: cleanMark(r.score, component.itemMax) }));
      if (rows.length > 0) out[`${component.key}__rows`] = rows;
      continue;
    }
    if (component.kind === "breaking") {
      for (let m = 1; m <= (component.methods ?? 3); m++) {
        const chosen = String(input?.[`pb_method_${m}`] ?? "").trim();
        if (chosen) out[`pb_method_${m}`] = chosen.slice(0, 80);
        for (let a = 1; a <= (component.attempts ?? 3); a++) {
          const value = cleanMark(input?.[`pb_m${m}_a${a}`], component.itemMax);
          if (value != null) out[`pb_m${m}_a${a}`] = value;
        }
      }
      continue;
    }
    for (const item of component.items) {
      const value = cleanMark(input?.[item.key], component.itemMax);
      if (value != null) out[item.key] = value;
    }
  }
  return out;
}

function toDto(reg: any, score: any, examinerName: string | null): ExamRowDto {
  const student = reg.students ?? {};
  const target = nextGrade(student.gup ?? null, student.dan ?? null);
  const components = (reg.event_categories?.exam_events as string[] | null) ?? [];
  const marks = (score?.marks ?? {}) as SheetMarks;
  return {
    registrationId: reg.id,
    competitionNumber: reg.competition_number ?? null,
    studentName: student.full_name ?? "",
    clubName: reg.clubs?.name ?? null,
    gender: student.gender ?? null,
    age: computeAge(student.birthday ?? null),
    currentGrade: gradeLabel(student.gup ?? null, student.dan ?? null),
    targetGrade: target?.label ?? null,
    categoryId: reg.category_id ?? null,
    categoryName: reg.event_categories?.name ?? null,
    components,
    status: reg.status ?? "pending",
    marks,
    remark: score?.remark ?? "",
    passed: score?.passed === true,
    total: score?.total != null ? Number(score.total) : sheetTotal(marks, componentsFor(components)),
    // The rank they'd be promoted to is the category they sat.
    approvedRank: score?.approved_rank ?? reg.event_categories?.name ?? target?.label ?? null,
    examinerName: score?.examiner_name ?? null,
    examinerSignature: score?.examiner_signature ?? null,
    locked: score?.locked === true,
    updatedAt: score?.updated_at ?? null,
    updatedBy: examinerName,
  };
}

const REG_SELECT =
  "id, status, category_id, competition_number, clubs(name), event_categories(name, exam_events), students(full_name, gender, birthday, gup, dan)";

/** Everyone entered, with whatever marks exist so far. */
export async function loadExamRows(eventId: string, categoryIds: string[]): Promise<ExamRowDto[]> {
  await requirePermission(PERMISSIONS.EVENT_VIEW);
  const supabase = supabaseAdmin();

  let query = supabase.from("event_registrations").select(REG_SELECT).eq("event_id", eventId);
  if (categoryIds.length > 0) query = query.in("category_id", categoryIds);
  const { data: regs } = await query.order("competition_number", { nullsFirst: false });

  const ids = (regs ?? []).map((r: any) => r.id);
  if (ids.length === 0) return [];

  const { data: scores } = await supabase.from("grading_exam_scores").select("*").in("registration_id", ids);
  const scoreByReg = new Map((scores ?? []).map((s: any) => [s.registration_id, s]));

  const examinerIds = Array.from(new Set((scores ?? []).map((s: any) => s.updated_by).filter(Boolean)));
  const nameById = new Map<string, string>();
  if (examinerIds.length > 0) {
    const { data: users } = await supabase.from("app_users").select("id, full_name, username").in("id", examinerIds);
    (users ?? []).forEach((u: any) => nameById.set(u.id, u.full_name || u.username));
  }

  const rows = (regs ?? []).map((r: any) => {
    const score = scoreByReg.get(r.id);
    return toDto(r, score, score?.updated_by ? nameById.get(score.updated_by) ?? null : null);
  });
  rows.sort((a, b) => a.studentName.localeCompare(b.studentName));
  return rows;
}

export type ExamSaveInput = {
  eventId: string;
  registrationId: string;
  marks: SheetMarks;
  remark: string;
  /** Left undefined to let the mark decide. */
  passed?: boolean;
  approvedRank: string | null;
  examinerSignature: string | null;
  /** Finish (Submit) saves and locks in one step. */
  lock?: boolean;
};

export async function saveExamRow(input: ExamSaveInput): Promise<ExamSaveResult> {
  try {
    const { session, supabase } = await assertCanMark(input.eventId);

    const { data: existing } = await supabase
      .from("grading_exam_scores")
      .select("locked")
      .eq("registration_id", input.registrationId)
      .maybeSingle();
    if (existing?.locked) return { error: "This candidate's sheet is completed. Press Resubmit before making changes." };

    // The components in play come from the event's syllabus and the category,
    // not the browser, so a stale page can't quietly widen what counts.
    const sheet = await loadSyllabus(input.eventId);
    const { data: reg } = await supabase
      .from("event_registrations")
      .select("event_categories(name, exam_events)")
      .eq("id", input.registrationId)
      .maybeSingle();
    const components = componentsFor(((reg as any)?.event_categories?.exam_events as string[] | null) ?? [], sheet);

    const marks = cleanMarks(input.marks, sheet);
    const total = sheetTotal(marks, components);
    const remark = input.remark.trim().slice(0, REMARK_MAX);

    // The tick follows the mark unless somebody has deliberately set it the
    // other way, which is the only reason `passed` is sent at all.
    const passed = input.passed ?? marksSayPassed(marks, components);

    // The examiner is whoever is signed in — not a name typed into a box.
    const examinerName = session.fullName || session.username;
    const signature = input.examinerSignature && input.examinerSignature.startsWith("data:image/png;base64,")
      ? input.examinerSignature.slice(0, 400_000)
      : null;

    const { error } = await supabase.from("grading_exam_scores").upsert(
      {
        registration_id: input.registrationId,
        marks,
        total,
        remark: remark || null,
        passed,
        approved_rank: input.approvedRank,
        examiner_name: examinerName,
        ...(signature ? { examiner_signature: signature } : {}),
        updated_by: session.sub,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "registration_id" },
    );
    if (error) return { error: "Could not save this sheet. Please try again." };

    // Finish (Submit) is a save and a lock together, so a submitted sheet can't
    // drift afterwards without somebody pressing Resubmit.
    if (input.lock) {
      await supabase
        .from("grading_exam_scores")
        .update({ locked: true, locked_by: session.sub, locked_at: new Date().toISOString() })
        .eq("registration_id", input.registrationId);
    }

    const row = await reloadRow(supabase, input.registrationId);
    if (!row) return { error: "Saved, but the sheet could not be reloaded. Refresh the page." };
    revalidatePath(`/events/${input.eventId}`);
    return { ok: true, row };
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { error: e instanceof Error ? e.message : "Could not save this sheet." };
  }
}

/**
 * Save several candidates at once.
 *
 * Reports per candidate rather than failing the lot: one locked sheet shouldn't
 * stop the other nineteen from saving.
 */
export async function saveExamRowsBulk(input: {
  eventId: string;
  rows: Omit<ExamSaveInput, "eventId">[];
}): Promise<{ saved: ExamRowDto[]; failures: { registrationId: string; error: string }[] }> {
  const saved: ExamRowDto[] = [];
  const failures: { registrationId: string; error: string }[] = [];

  for (const row of input.rows) {
    const result = await saveExamRow({ ...row, eventId: input.eventId });
    if ("error" in result) failures.push({ registrationId: row.registrationId, error: result.error });
    else saved.push(result.row);
  }
  return { saved, failures };
}

export async function setExamLock(input: {
  eventId: string;
  registrationId: string;
  locked: boolean;
}): Promise<ExamSaveResult> {
  try {
    const { session, supabase } = await assertCanMark(input.eventId);

    const { error } = await supabase.from("grading_exam_scores").upsert(
      {
        registration_id: input.registrationId,
        locked: input.locked,
        locked_by: input.locked ? session.sub : null,
        locked_at: input.locked ? new Date().toISOString() : null,
        updated_by: session.sub,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "registration_id" },
    );
    if (error) return { error: "Could not change the lock. Please try again." };

    const row = await reloadRow(supabase, input.registrationId);
    if (!row) return { error: "Refresh the page to see the current state." };
    revalidatePath(`/events/${input.eventId}`);
    return { ok: true, row };
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { error: e instanceof Error ? e.message : "Could not change the lock." };
  }
}

async function reloadRow(supabase: any, registrationId: string): Promise<ExamRowDto | null> {
  const { data: reg } = await supabase.from("event_registrations").select(REG_SELECT).eq("id", registrationId).maybeSingle();
  if (!reg) return null;
  const { data: score } = await supabase.from("grading_exam_scores").select("*").eq("registration_id", registrationId).maybeSingle();
  let examiner: string | null = null;
  if (score?.updated_by) {
    const { data: user } = await supabase.from("app_users").select("full_name, username").eq("id", score.updated_by).maybeSingle();
    examiner = user?.full_name || user?.username || null;
  }
  return toDto(reg, score, examiner);
}

/**
 * Choose which components a grading category is marked on.
 *
 * Junior grades don't sit power breaking, so their categories carry a shorter
 * list. Each component keeps its own share of the 100 marks either way.
 */
export async function setCategoryEvents(input: {
  eventId: string;
  categoryId: string;
  eventKeys: string[];
}): Promise<{ ok: true } | { error: string }> {
  try {
    const { supabase } = await assertCanMark(input.eventId);
    const valid = (await loadSyllabus(input.eventId)).map((c) => c.key);
    const chosen = input.eventKeys.filter((k) => valid.includes(k));
    if (chosen.length === 0) return { error: "Pick at least one component for this category." };

    const { error } = await supabase
      .from("event_categories")
      .update({ exam_events: chosen.length === valid.length ? null : chosen })
      .eq("id", input.categoryId)
      .eq("event_id", input.eventId);
    if (error) return { error: "Could not save the components for this category." };

    revalidatePath(`/events/${input.eventId}`);
    return { ok: true };
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { error: e instanceof Error ? e.message : "Could not save the components." };
  }
}

/** The signed-in examiner's own saved signature, for the Import button. */
export async function loadMySignature(): Promise<{ name: string; signature: string | null }> {
  const session = await requireSession();
  const { data } = await supabaseAdmin().from("app_users").select("full_name, username, signature_png").eq("id", session.sub).maybeSingle();
  return {
    name: data?.full_name || data?.username || session.fullName || session.username,
    signature: data?.signature_png ?? null,
  };
}

/** Save the event's syllabus: its components, contents and marks. */
export async function saveSyllabus(input: {
  eventId: string;
  sheet: unknown;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const { session, supabase } = await assertCanMark(input.eventId);
    const sheet = parseSheet(input.sheet);
    const total = sheet.reduce((n, c) => n + c.max, 0);
    if (total <= 0) return { error: "The syllabus needs at least one component worth some marks." };

    const { error } = await supabase.from("exam_syllabus").upsert(
      { event_id: input.eventId, sheet, updated_by: session.sub, updated_at: new Date().toISOString() },
      { onConflict: "event_id" },
    );
    if (error) return { error: "The syllabus could not be saved. Please try again." };

    revalidatePath(`/events/${input.eventId}`);
    return { ok: true };
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { error: e instanceof Error ? e.message : "The syllabus could not be saved." };
  }
}

/** Put the syllabus back to the built-in sheet. */
export async function resetSyllabus(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) return;
  const { supabase } = await assertCanMark(eventId);
  await supabase.from("exam_syllabus").delete().eq("event_id", eventId);
  revalidatePath(`/events/${eventId}`);
}

/** Create every grading category up front, before anybody has registered. */
export async function addAllGradingCategories(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) return;
  await assertCanMark(eventId);
  const supabase = supabaseAdmin();
  for (const grade of GRADE_OPTIONS.slice(1)) {
    await ensureCategoryForTarget(supabase, eventId, grade.value);
  }
  revalidatePath(`/events/${eventId}`);
}

/**
 * Work out the category for every entry from the grade each student holds now.
 * Categories chosen by hand are left alone.
 */
export async function syncAllGradingCategories(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) return;
  const { supabase } = await assertCanMark(eventId);

  const { data: regs } = await supabase
    .from("event_registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("category_locked", false);

  for (const reg of regs ?? []) {
    await syncGradingCategory(supabase, eventId, reg.id);
  }
  revalidatePath(`/events/${eventId}`);
}

/**
 * Publishing is the step everyone with access can see the results of, so it is
 * kept to a Super Admin and whoever created the event.
 */
async function assertCanPublish(eventId: string) {
  const session = await requireSession();
  const supabase = supabaseAdmin();
  const { data: event } = await supabase.from("events").select("id, created_by").eq("id", eventId).maybeSingle();
  if (!event) throw new Error("Event not found.");
  if (!canOverrideLocks({ sub: session.sub, role: session.role }, event as any)) {
    throw new Error("Only a Super Admin or the person who created this event can publish its results.");
  }
  return { session, supabase };
}

export async function publishResults(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) return;
  const { session, supabase } = await assertCanPublish(eventId);
  await supabase
    .from("events")
    .update({ results_published_at: new Date().toISOString(), results_published_by: session.sub })
    .eq("id", eventId);

  await promotePassedCandidates(supabase, eventId);

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/students");
  revalidatePath(`/public/events/${eventId}`);
}

/**
 * Move everyone who passed up to the rank they were approved for.
 *
 * Publishing is the moment the result becomes real, so it's also the moment the
 * grade changes. Only passes count, and only upwards — a result that would move
 * somebody *down* is left alone, since that's far more likely to be a typo in
 * the approved rank than a demotion.
 *
 * Re-publishing is harmless: a student already at that grade is skipped.
 */
async function promotePassedCandidates(supabase: any, eventId: string): Promise<number> {
  const { data: regs } = await supabase
    .from("event_registrations")
    .select("id, student_id, event_categories(name), students(gup, dan)")
    .eq("event_id", eventId);

  const ids = (regs ?? []).map((r: any) => r.id);
  if (ids.length === 0) return 0;

  const { data: scores } = await supabase
    .from("grading_exam_scores")
    .select("registration_id, passed, approved_rank")
    .in("registration_id", ids);
  const scoreByReg = new Map((scores ?? []).map((s: any) => [s.registration_id, s]));

  let promoted = 0;
  for (const reg of regs ?? []) {
    const score = scoreByReg.get(reg.id);
    if (!score || score.passed !== true || !reg.student_id) continue;

    const label = String(score.approved_rank ?? (reg as any).event_categories?.name ?? "").trim();
    if (!label) continue;

    // The rank is text an examiner could have edited, so it's read back through
    // the same parser the rest of the app uses rather than trusted.
    const { gup, dan } = parseGradeText(label);
    if (gup == null && dan == null) continue;

    const current = (reg as any).students ?? {};
    if (gradeRank(gup, dan) <= gradeRank(current.gup ?? null, current.dan ?? null)) continue;

    await supabase.from("students").update({ gup, dan }).eq("id", reg.student_id);
    promoted++;
  }
  return promoted;
}

export async function unpublishResults(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) return;
  const { supabase } = await assertCanPublish(eventId);
  await supabase.from("events").update({ results_published_at: null, results_published_by: null }).eq("id", eventId);
  revalidatePath(`/events/${eventId}`);
}
