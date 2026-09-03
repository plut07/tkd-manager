/**
 * The name a registration competes under.
 *
 * A registration used to be one student, so every screen that needed a name
 * read `students.full_name` and that was the end of it. Team events changed
 * that: a team is also a registration -- deliberately, so the draw, the
 * seeding, the numbering and the scoreboard did not each have to learn what a
 * team is -- but it has a team sheet behind it rather than a single person.
 *
 * So there is now one question, "what is this competitor called", and one place
 * that answers it. Six screens were asking it slightly differently.
 */

/** A student as the various queries return them, joined one way or another. */
type JoinedStudent = { full_name?: string | null } | { full_name?: string | null }[] | null | undefined;

export type CompetitorRow = {
  is_team?: boolean | null;
  team_name?: string | null;
  students?: JoinedStudent;
};

/**
 * The columns every caller needs in its select.
 *
 * Exported so the six of them cannot drift: a screen that forgets `team_name`
 * shows a team as an empty name, which looks like missing data rather than
 * like a bug.
 */
export const COMPETITOR_NAME_COLUMNS = "is_team, team_name, students(full_name)";

function studentName(students: JoinedStudent): string {
  if (!students) return "";
  // Supabase gives a to-one join as an object, but the same relationship
  // arrives as a one-element array in some shapes of query. Both mean one
  // student.
  const one = Array.isArray(students) ? students[0] : students;
  return one?.full_name ?? "";
}

export function competitorName(row: CompetitorRow | null | undefined): string {
  if (!row) return "";
  if (row.is_team) return row.team_name ?? "";
  return studentName(row.students);
}

/** The same, with something to show when there is nothing. */
export function competitorNameOr(row: CompetitorRow | null | undefined, fallback: string): string {
  return competitorName(row) || fallback;
}
