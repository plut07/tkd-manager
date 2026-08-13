/**
 * What a grading exam is marked on.
 *
 * Each event is a tick rather than a score: the examiner marks whether the
 * candidate passed that part. The overall Passed tick is the examiner's own
 * judgement and is deliberately separate — a candidate can pass every event and
 * still be held back, or the reverse.
 *
 * Deliberately plain — no server-only or database imports — so the same
 * definitions drive the examiner's screen, the server action that validates a
 * save, and the published result list. The `key` values are the actual column
 * names in `grading_exam_scores`; renaming one would need a migration.
 */

export type ExamEvent = {
  key: ExamEventKey;
  label: string;
  short: string;
  /** The three parts every grading covers. Marked with * on screen. */
  required: boolean;
};

export type ExamEventKey =
  | "basic_technique"
  | "pattern"
  | "step_sparring"
  | "sparring"
  | "breaking"
  | "stamina";

export const EXAM_EVENTS: ExamEvent[] = [
  { key: "basic_technique", label: "Basic Technique", short: "Basic Technique", required: true },
  { key: "pattern", label: "Pattern", short: "Pattern", required: true },
  { key: "step_sparring", label: "Step Sparring", short: "Step Sparring", required: true },
  { key: "sparring", label: "Sparring", short: "Sparring", required: false },
  { key: "breaking", label: "Breaking", short: "Breaking", required: false },
  { key: "stamina", label: "Stamina", short: "Stamina", required: false },
];

export const REQUIRED_EVENTS: ExamEventKey[] = EXAM_EVENTS.filter((e) => e.required).map((e) => e.key);

/** One tick per event. Absent or false both mean "not passed". */
export type ExamMarks = Partial<Record<ExamEventKey, boolean | null>>;

export type ExamRow = ExamMarks & {
  registration_id: string;
  remark: string | null;
  passed: boolean | null;
  locked: boolean;
  updated_at?: string | null;
};

/** Coerce whatever arrives from a form or the database into a plain tick. */
export function cleanTick(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === 1 || value === "1";
}

/** How many events the candidate was ticked for. */
export function ticksGiven(marks: ExamMarks): number {
  return EXAM_EVENTS.reduce((n, e) => n + (cleanTick(marks[e.key]) ? 1 : 0), 0);
}

/** The three core events they passed, for a quick read on the result list. */
export function requiredTicksGiven(marks: ExamMarks): number {
  return EXAM_EVENTS.reduce((n, e) => n + (e.required && cleanTick(marks[e.key]) ? 1 : 0), 0);
}

/** A short summary such as "4 of 6" for the results table. */
export function ticksSummary(marks: ExamMarks): string {
  return `${ticksGiven(marks)} of ${EXAM_EVENTS.length}`;
}
