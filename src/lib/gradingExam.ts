/**
 * What a grading exam is marked on.
 *
 * Deliberately plain — no server-only or database imports — so the same
 * definitions drive the examiner's screen, the server action that validates a
 * save, and the published result list. The `column` values are the actual
 * column names in `grading_exam_scores`; renaming one would need a migration.
 */

export type ExamEvent = {
  key: ExamEventKey;
  label: string;
  short: string;
  /** Mandatory events must be scored before a student can be marked or locked. */
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
  { key: "basic_technique", label: "Basic Technique", short: "Basic", required: true },
  { key: "pattern", label: "Pattern", short: "Pattern", required: true },
  { key: "step_sparring", label: "Step Sparring", short: "Step", required: true },
  { key: "sparring", label: "Sparring", short: "Sparring", required: false },
  { key: "breaking", label: "Breaking", short: "Breaking", required: false },
  { key: "stamina", label: "Stamina", short: "Stamina", required: false },
];

export const REQUIRED_EVENTS: ExamEventKey[] = EXAM_EVENTS.filter((e) => e.required).map((e) => e.key);

/** Every score is out of ten. */
export const SCORE_MIN = 1;
export const SCORE_MAX = 10;
export const SCORE_CHOICES: number[] = Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => SCORE_MIN + i);

export type ExamScores = Partial<Record<ExamEventKey, number | null>>;

export type ExamRow = ExamScores & {
  registration_id: string;
  remark: string | null;
  passed: boolean | null;
  locked: boolean;
  updated_at?: string | null;
};

/** Keeps a value inside 1-10, or null when the examiner hasn't marked it. */
export function cleanScore(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < SCORE_MIN || rounded > SCORE_MAX) return null;
  return rounded;
}

/** Which mandatory events are still blank. Empty means the row can be locked. */
export function missingRequired(scores: ExamScores): ExamEvent[] {
  return EXAM_EVENTS.filter((e) => e.required && cleanScore(scores[e.key]) == null);
}

/** Sum of everything scored so far. Unscored events simply don't count. */
export function examTotal(scores: ExamScores): number {
  return EXAM_EVENTS.reduce((sum, e) => sum + (cleanScore(scores[e.key]) ?? 0), 0);
}

/** The highest total available given how many events were actually scored. */
export function examMaxTotal(scores: ExamScores): number {
  return EXAM_EVENTS.reduce((sum, e) => sum + (cleanScore(scores[e.key]) != null ? SCORE_MAX : 0), 0);
}

/** Average across scored events, to one decimal, or null when nothing is marked. */
export function examAverage(scores: ExamScores): number | null {
  const marked = EXAM_EVENTS.map((e) => cleanScore(scores[e.key])).filter((v): v is number => v != null);
  if (marked.length === 0) return null;
  return Math.round((marked.reduce((a, b) => a + b, 0) / marked.length) * 10) / 10;
}
