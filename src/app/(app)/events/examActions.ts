"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireSession } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { gradeLabel, nextGrade, GRADE_OPTIONS } from "@/lib/belts";
import { computeAge } from "@/lib/eligibility";
import { effectiveEventStatus, canOverrideLocks } from "@/lib/eventStatus";
import { cleanScore, EXAM_EVENTS, type ExamEventKey } from "@/lib/gradingExam";
import { ensureCategoryForTarget, syncGradingCategory } from "@/lib/gradingCategory";

/**
 * Marking a grading.
 *
 * Several examiners work the same event at once, each usually on a different
 * student, so a save writes one student's row and nothing else — two examiners
 * can never overwrite each other's marks. A locked row is refused outright, and
 * the examiner is told who locked it.
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
  /** The event keys this candidate's category is marked on. */
  examEvents: string[];
  status: string;
  scores: Record<ExamEventKey, number | null>;
  remark: string;
  passed: boolean;
  locked: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type ExamSaveResult = { ok: true; row: ExamRowDto } | { error: string };

/**
 * A signed-out user's save throws Next's internal redirect, which must travel
 * up rather than be reported as "couldn't save" — otherwise they'd sit there
 * retrying instead of being sent to the login page.
 */
function isRedirect(e: unknown): boolean {
  return typeof e === "object" && e !== null && typeof (e as any).digest === "string" && (e as any).digest.startsWith("NEXT_REDIRECT");
}

const EMPTY_SCORES = (): Record<ExamEventKey, number | null> =>
  Object.fromEntries(EXAM_EVENTS.map((e) => [e.key, null])) as Record<ExamEventKey, number | null>;

/**
 * Marking stays open while the event is running and closes when it finishes,
 * matching the rest of the event's read-only behaviour. A Super Admin or the
 * person who created the event can still correct a result afterwards.
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

function toDto(reg: any, score: any, examinerName: string | null): ExamRowDto {
  const student = reg.students ?? {};
  const target = nextGrade(student.gup ?? null, student.dan ?? null);
  const scores = EMPTY_SCORES();
  for (const e of EXAM_EVENTS) scores[e.key] = cleanScore(score?.[e.key]);
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
    examEvents: (reg.event_categories?.exam_events as string[] | null) ?? [],
    status: reg.status ?? "pending",
    scores,
    remark: score?.remark ?? "",
    passed: score?.passed === true,
    locked: score?.locked === true,
    updatedAt: score?.updated_at ?? null,
    updatedBy: examinerName,
  };
}

const REG_SELECT =
  "id, status, category_id, competition_number, clubs(name), event_categories(name, exam_events), students(full_name, gender, birthday, gup, dan)";

/** Everyone entered in the chosen categories, with whatever marks exist so far. */
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

  // One lookup for every examiner named on a row, rather than one per row.
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

  // Sort by name within the list so examiners can find people quickly.
  rows.sort((a, b) => a.studentName.localeCompare(b.studentName));
  return rows;
}

export async function saveExamRow(input: {
  eventId: string;
  registrationId: string;
  scores: Partial<Record<ExamEventKey, number | null>>;
  remark: string;
  passed: boolean;
}): Promise<ExamSaveResult> {
  try {
    const { session, supabase } = await assertCanMark(input.eventId);

    const { data: existing } = await supabase
      .from("grading_exam_scores")
      .select("locked, locked_by")
      .eq("registration_id", input.registrationId)
      .maybeSingle();
    if (existing?.locked) return { error: "This student's marks are locked. Unlock them before making changes." };

    const cleaned: Record<string, number | null> = {};
    for (const e of EXAM_EVENTS) cleaned[e.key] = cleanScore(input.scores[e.key]);

    const { error } = await supabase.from("grading_exam_scores").upsert(
      {
        registration_id: input.registrationId,
        ...cleaned,
        remark: input.remark.trim() || null,
        passed: input.passed,
        updated_by: session.sub,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "registration_id" },
    );
    if (error) return { error: "Could not save these marks. Please try again." };

    const row = await reloadRow(supabase, input.registrationId);
    if (!row) return { error: "Saved, but the row could not be reloaded. Refresh the page." };
    revalidatePath(`/events/${input.eventId}`);
    return { ok: true, row };
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { error: e instanceof Error ? e.message : "Could not save these marks." };
  }
}

/**
 * Save marks for several candidates at once.
 *
 * The examiner sets up a screen full of results and commits them together, so
 * this returns what happened per candidate rather than failing the lot: a
 * locked row shouldn't stop the other nineteen from saving.
 */
export async function saveExamRowsBulk(input: {
  eventId: string;
  rows: {
    registrationId: string;
    scores: Partial<Record<ExamEventKey, number | null>>;
    remark: string;
    passed: boolean;
  }[];
}): Promise<{ saved: ExamRowDto[]; failures: { registrationId: string; error: string }[] }> {
  const saved: ExamRowDto[] = [];
  const failures: { registrationId: string; error: string }[] = [];

  for (const row of input.rows) {
    const result = await saveExamRow({
      eventId: input.eventId,
      registrationId: row.registrationId,
      scores: row.scores,
      remark: row.remark,
      passed: row.passed,
    });
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

    const { data: existing } = await supabase
      .from("grading_exam_scores")
      .select("*")
      .eq("registration_id", input.registrationId)
      .maybeSingle();

    // Locking is just "I'm done with this one" — no preconditions. An examiner
    // locking their own candidate shouldn't be blocked by anybody else's row,
    // or by parts of the exam this candidate didn't sit.
    void existing;

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
 * Publishing is the irreversible-feeling step — everyone with access to the
 * event can see the results afterwards — so it is kept to a Super Admin and
 * whoever created the event, even though any examiner can enter marks.
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

/**
 * Work out the category for every entry in a grading from the grade each
 * student holds now.
 *
 * Entries approved before the category rule existed have none, and a student
 * whose grade was corrected after approval may be in the wrong one. Categories
 * chosen by hand are left alone.
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
 * Choose which events a grading category is marked on.
 *
 * Junior grades don't sit breaking or knife work, so their categories carry a
 * shorter list. The total is always presented out of 100 whichever list applies,
 * so marks stay comparable across the day.
 */
export async function setCategoryEvents(input: {
  eventId: string;
  categoryId: string;
  eventKeys: string[];
}): Promise<{ ok: true } | { error: string }> {
  try {
    const { supabase } = await assertCanMark(input.eventId);
    const valid = EXAM_EVENTS.map((e) => e.key as string);
    const chosen = input.eventKeys.filter((k) => valid.includes(k));
    if (chosen.length === 0) return { error: "Pick at least one event for this category." };

    const { error } = await supabase
      .from("event_categories")
      .update({ exam_events: chosen.length === valid.length ? null : chosen })
      .eq("id", input.categoryId)
      .eq("event_id", input.eventId);
    if (error) return { error: "Could not save the event list for this category." };

    revalidatePath(`/events/${input.eventId}`);
    return { ok: true };
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { error: e instanceof Error ? e.message : "Could not save the event list." };
  }
}

/**
 * Create every grading category up front, so an organiser can set each one's
 * events before anybody has registered for it.
 */
export async function addAllGradingCategories(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) return;
  await assertCanMark(eventId);
  const supabase = supabaseAdmin();

  // Every grade except the first can be graded *to*; the first is where you start.
  for (const grade of GRADE_OPTIONS.slice(1)) {
    await ensureCategoryForTarget(supabase, eventId, grade.value);
  }
  revalidatePath(`/events/${eventId}`);
}

export async function publishResults(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) return;
  const { session, supabase } = await assertCanPublish(eventId);
  await supabase
    .from("events")
    .update({ results_published_at: new Date().toISOString(), results_published_by: session.sub })
    .eq("id", eventId);
  revalidatePath(`/events/${eventId}`);
}

export async function unpublishResults(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) return;
  const { supabase } = await assertCanPublish(eventId);
  await supabase.from("events").update({ results_published_at: null, results_published_by: null }).eq("id", eventId);
  revalidatePath(`/events/${eventId}`);
}
