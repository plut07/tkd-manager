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

/**
 * Every exam is presented out of 100, however many events it covers.
 *
 * A category marked on all eight events scores 80 raw and scales by 1.25; a
 * junior category marked on four scores 40 raw and scales by 2.5. Keeping the
 * ceiling fixed means a mark means the same thing across the whole event.
 */
export const TOTAL_MAX = 100;

/** The events a category is marked on. An empty or missing list means all. */
export function eventsFor(keys: readonly string[] | null | undefined): ExamEvent[] {
  if (!keys || keys.length === 0) return EXAM_EVENTS;
  const wanted = new Set(keys);
  const chosen = EXAM_EVENTS.filter((e) => wanted.has(e.key));
  return chosen.length > 0 ? chosen : EXAM_EVENTS;
}

/** What each raw point is worth for a given event list. */
export function scaleFor(events: ExamEvent[]): number {
  const raw = events.length * SCORE_MAX;
  return raw > 0 ? TOTAL_MAX / raw : 0;
}

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

/** Raw points across the events this candidate is marked on. */
export function rawTotal(scores: ExamScores, events: ExamEvent[] = EXAM_EVENTS): number {
  return events.reduce((sum, e) => sum + (cleanScore(scores[e.key]) ?? 0), 0);
}

/** The mark out of 100 for the given event list. */
export function examTotal(scores: ExamScores, events: ExamEvent[] = EXAM_EVENTS): number {
  return Math.round(rawTotal(scores, events) * scaleFor(events) * 100) / 100;
}

/** Whether the marks alone would pass, before any examiner override. */
export function scoreSaysPassed(scores: ExamScores, events: ExamEvent[] = EXAM_EVENTS): boolean {
  return examTotal(scores, events) > PASS_MARK;
}

/** Which mandatory events are still unmarked. */
export function missingRequired(scores: ExamScores, events: ExamEvent[] = EXAM_EVENTS): ExamEvent[] {
  return events.filter((e) => e.required && cleanScore(scores[e.key]) == null);
}

/** How many of this candidate's events have been marked at all. */
export function marksGiven(scores: ExamScores, events: ExamEvent[] = EXAM_EVENTS): number {
  return events.reduce((n, e) => n + (cleanScore(scores[e.key]) != null ? 1 : 0), 0);
}
