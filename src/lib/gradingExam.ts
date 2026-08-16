/**
 * What a grading exam is marked on.
 *
 * Eight events, ten points each, so a perfect exam is 80 raw points. That is
 * multiplied by 1.25 to give a mark out of 100, which is what examiners and
 * candidates actually talk about.
 *
 * Zero is a real mark — a candidate can attempt an event and score nothing —
 * so "unmarked" is null rather than 0, and the two are kept apart everywhere.
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
  | "stamina"
  | "self_defend"
  | "knife_self_defend";

export const EXAM_EVENTS: ExamEvent[] = [
  { key: "basic_technique", label: "Basic Technique", short: "Basic Technique", required: true },
  { key: "pattern", label: "Pattern", short: "Pattern", required: true },
  { key: "step_sparring", label: "Step Sparring", short: "Step Sparring", required: true },
  { key: "sparring", label: "Sparring", short: "Sparring", required: false },
  { key: "breaking", label: "Breaking", short: "Breaking", required: false },
  { key: "stamina", label: "Stamina", short: "Stamina", required: false },
  { key: "self_defend", label: "Self Defend", short: "Self Defend", required: false },
  { key: "knife_self_defend", label: "Knife Self Defend", short: "Knife Self Defend", required: false },
];

export const REQUIRED_EVENTS: ExamEventKey[] = EXAM_EVENTS.filter((e) => e.required).map((e) => e.key);

/** Marks run 0-10 inclusive. Zero counts; null means not marked yet. */
export const SCORE_MIN = 0;
export const SCORE_MAX = 10;
export const SCORE_CHOICES: number[] = Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => SCORE_MIN + i);

/** 8 events x 10 points = 80 raw, scaled to a mark out of 100. */
export const RAW_MAX = EXAM_EVENTS.length * SCORE_MAX;
export const SCALE = 1.25;
export const TOTAL_MAX = RAW_MAX * SCALE;

/** Above this the exam is a pass. An examiner can still override either way. */
export const PASS_MARK = 50;

export type ExamScores = Partial<Record<ExamEventKey, number | null>>;

export type ExamRow = ExamScores & {
  registration_id: string;
  remark: string | null;
  passed: boolean | null;
  locked: boolean;
  updated_at?: string | null;
};

/** Keep a value inside 0-10, or null when the examiner hasn't marked it. */
export function cleanScore(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < SCORE_MIN || rounded > SCORE_MAX) return null;
  return rounded;
}

/** Raw points across the eight events. Unmarked events contribute nothing. */
export function rawTotal(scores: ExamScores): number {
  return EXAM_EVENTS.reduce((sum, e) => sum + (cleanScore(scores[e.key]) ?? 0), 0);
}

/** The mark out of 100: raw points scaled by 1.25. */
export function examTotal(scores: ExamScores): number {
  return Math.round(rawTotal(scores) * SCALE * 100) / 100;
}

/** Whether the marks alone would pass, before any examiner override. */
export function scoreSaysPassed(scores: ExamScores): boolean {
  return examTotal(scores) > PASS_MARK;
}

/** Which mandatory events are still unmarked. */
export function missingRequired(scores: ExamScores): ExamEvent[] {
  return EXAM_EVENTS.filter((e) => e.required && cleanScore(scores[e.key]) == null);
}

/** How many of the eight events have been marked at all. */
export function marksGiven(scores: ExamScores): number {
  return EXAM_EVENTS.reduce((n, e) => n + (cleanScore(scores[e.key]) != null ? 1 : 0), 0);
}
