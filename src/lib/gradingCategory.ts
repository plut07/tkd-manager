import "server-only";
import { nextGrade, gradeRank, GRADE_OPTIONS, type GradeOption } from "./belts";

/**
 * Grading categories aren't typed in by hand — a candidate is always examined
 * for the grade one step above the one they hold, so the category follows from
 * the student's record:
 *
 *   White                  -> White Yellow / Yellow Tip
 *   Red Black / Black Tip  -> 1st Dan
 *   8th Dan                -> 9th Dan
 *   9th Dan                -> nothing above it
 *
 * The category is created the first time somebody registers for it, which keeps
 * the list to the grades actually being examined on the day rather than all
 * nineteen.
 *
 * Note which grades go in `gup_list` / `dan_list`: those columns describe who is
 * *eligible*, so they hold the grade below the category — the one candidates
 * currently hold. The category's name carries the grade being taken.
 */

export const GRADING_CATEGORY_TYPE = "grading";

/** The category a student at this grade belongs in, by name. */
export function gradingCategoryName(gup: number | null, dan: number | null): string | null {
  const target = nextGrade(gup, dan);
  return target ? target.label : null;
}

/** The grade directly below a category — the grade its candidates hold now. */
function gradeBelow(target: GradeOption): GradeOption | null {
  const i = GRADE_OPTIONS.findIndex((g) => g.value === target.value);
  return i > 0 ? GRADE_OPTIONS[i - 1] : null;
}

/**
 * Find or create the category for a grade being taken.
 * `targetValue` is a GRADE_OPTIONS value such as "G9" or "D1".
 */
export async function ensureCategoryForTarget(
  supabase: any,
  eventId: string,
  targetValue: string,
): Promise<string | null> {
  const target = GRADE_OPTIONS.find((g) => g.value === targetValue);
  if (!target) return null;

  const { data: existing } = await supabase
    .from("event_categories")
    .select("id")
    .eq("event_id", eventId)
    .eq("name", target.label)
    .maybeSingle();
  if (existing) return existing.id;

  const below = gradeBelow(target);
  const { data: created, error } = await supabase
    .from("event_categories")
    .insert({
      event_id: eventId,
      name: target.label,
      type: GRADING_CATEGORY_TYPE,
      gup_list: below?.gup != null ? [below.gup] : [],
      dan_list: below?.dan != null ? [below.dan] : [],
      gender_list: [],
      sort_order: gradeRank(target.gup, target.dan),
    })
    .select("id")
    .single();
  if (created) return created.id;

  // Two people registering the same grade at the same moment can race here;
  // whoever loses just reads back the row the other one made.
  const { data: retry } = await supabase
    .from("event_categories")
    .select("id")
    .eq("event_id", eventId)
    .eq("name", target.label)
    .maybeSingle();
  if (retry) return retry.id;

  // Anything else is a real failure. Swallowing it here is what let a rejected
  // insert look like "the category just didn't save" for a whole release.
  throw new Error(
    `The "${target.label}" category could not be created${error?.message ? `: ${error.message}` : "."}`,
  );
}

/**
 * Find or create the category for a student's current grade.
 * Returns null when there is nothing above their grade (9th Dan).
 */
export async function gradingCategoryIdFor(
  supabase: any,
  eventId: string,
  gup: number | null,
  dan: number | null,
): Promise<string | null> {
  const target = nextGrade(gup, dan);
  if (!target) return null;
  return ensureCategoryForTarget(supabase, eventId, target.value);
}

/**
 * Work out a registration's category from the student's current grade and store
 * it. Called when an entry is approved, so the category reflects the grade the
 * student holds at that moment — if their grade was corrected between
 * registering and approval, approval picks the correction up.
 *
 * A category chosen by hand (category_locked) is left alone: an organiser's
 * decision outranks the automatic one.
 */
export async function syncGradingCategory(
  supabase: any,
  eventId: string,
  registrationId: string,
): Promise<void> {
  const { data: reg } = await supabase
    .from("event_registrations")
    .select("id, category_id, category_locked, students(gup, dan)")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg || reg.category_locked) return;

  const categoryId = await gradingCategoryIdFor(supabase, eventId, reg.students?.gup ?? null, reg.students?.dan ?? null);
  if (!categoryId || categoryId === reg.category_id) return;
  await supabase.from("event_registrations").update({ category_id: categoryId }).eq("id", registrationId);
}

/** The message shown when someone tries to enter a student at the top grade. */
export const TOP_GRADE_MESSAGE =
  "9th Dan is the highest grade on the ladder, so this student can't take part in a grading.";
