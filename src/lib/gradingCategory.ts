import "server-only";
import { nextGrade, gradeRank } from "./belts";

/**
 * Grading categories aren't typed in by hand — a candidate is always testing
 * for the grade one step above the one they hold, so the category follows from
 * the student's record.
 *
 * The category is created the first time somebody with that current grade
 * registers, which keeps the list to exactly the grades being examined on the
 * day rather than all seventeen.
 *
 * Note which grades go in `gup_list` / `dan_list`: those columns describe who is
 * *eligible*, so they hold the student's current grade, not the one being tested
 * for. The name carries the target.
 */

export const GRADING_CATEGORY_TYPE = "grading";

/** The category name shown everywhere, e.g. "Grading to 1st Dan". */
export function gradingCategoryName(gup: number | null, dan: number | null): string | null {
  const target = nextGrade(gup, dan);
  return target ? `Grading to ${target.label}` : null;
}

/**
 * Find or create the category for a student's current grade.
 * Returns null when there is nothing above their grade (7th Dan).
 */
export async function gradingCategoryIdFor(
  supabase: any,
  eventId: string,
  gup: number | null,
  dan: number | null,
): Promise<string | null> {
  const name = gradingCategoryName(gup, dan);
  if (!name) return null;

  const { data: existing } = await supabase
    .from("event_categories")
    .select("id")
    .eq("event_id", eventId)
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("event_categories")
    .insert({
      event_id: eventId,
      name,
      type: GRADING_CATEGORY_TYPE,
      gup_list: gup != null ? [gup] : [],
      dan_list: dan != null ? [dan] : [],
      gender_list: [],
      sort_order: gradeRank(gup, dan),
    })
    .select("id")
    .single();

  if (created) return created.id;

  // Two examiners registering the same grade at once can race here; whoever
  // lost the race just reads back the row the other one made.
  const { data: retry } = await supabase
    .from("event_categories")
    .select("id")
    .eq("event_id", eventId)
    .eq("name", name)
    .maybeSingle();
  return retry?.id ?? null;
}

/** The message shown when someone tries to enter a student at the top grade. */
export const TOP_GRADE_MESSAGE =
  "7th Dan is the highest grade on the ladder, so this student can't take part in a grading.";
