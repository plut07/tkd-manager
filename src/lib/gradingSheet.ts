/**
 * The grading sheet.
 *
 * Six components by default, each with its own contents and its own share of
 * the 100 marks — the shape of the printed form. An event can override the
 * whole thing from the Exam Syllabus tab, so patterns can be added to the
 * syllabus without a code change.
 *
 * Three kinds of component:
 *
 *   fixed     every content column is always marked (Fundamental, Sparring)
 *   select    the examiner picks which ones were performed, and can add more
 *             rows (Pattern, Step-Sparring)
 *   breaking  three chosen techniques, three attempts each (Power Breaking)
 *
 * A component's Alloted mark is its rows added up, capped at its Max, so
 * generous individual marks can't push a component past its share of the paper.
 *
 * Deliberately plain: no server-only or database imports, so the same
 * definitions drive the marking screen, the save, the result list and the PDF.
 */

import { isCompleteBreakingValue } from "./powerBreaking";

export type SheetItem = { key: string; label: string };

export type ComponentKind = "fixed" | "select" | "breaking";

export type SheetComponent = {
  key: string;
  label: string;
  /** This component's share of the 100 marks. */
  max: number;
  /** The most any single row may be given. */
  itemMax: number;
  kind: ComponentKind;
  /** For "fixed": the columns. For "select": what can be chosen. */
  items: SheetItem[];
  /** For "select": how many rows to offer at minimum. */
  minRows?: number;
  /** For "breaking": how many techniques, and how many attempts each. */
  methods?: number;
  attempts?: number;
};

export const PATTERNS: SheetItem[] = [
  { key: "saju_jirugi", label: "Saju Jirugi" },
  { key: "saju_makgi", label: "Saju Makgi" },
  { key: "chon_ji", label: "Chon-Ji" },
  { key: "dan_gun", label: "Dan-Gun" },
  { key: "do_san", label: "Do-San" },
  { key: "won_hyo", label: "Won-Hyo" },
  { key: "yul_gok", label: "Yul-Gok" },
  { key: "joong_gun", label: "Joong-Gun" },
  { key: "toi_gye", label: "Toi-Gye" },
  { key: "hwa_rang", label: "Hwa-Rang" },
  { key: "choong_moo", label: "Choong-Moo" },
];

export const STEP_SPARRING_ITEMS: SheetItem[] = [
  { key: "sambo_matsogi", label: "Sambo Matsogi" },
  { key: "ilbo_matsogi", label: "Ilbo Matsogi" },
  { key: "self_defence", label: "Self Defence" },
];

/** The sheet used when an event hasn't customised its syllabus. */
export const DEFAULT_SHEET: SheetComponent[] = [
  {
    key: "fundamental",
    label: "Fundamental",
    max: 15,
    itemMax: 15,
    kind: "fixed",
    items: [
      { key: "hand_techniques", label: "Hand Techniques" },
      { key: "foot_techniques", label: "Foot Techniques" },
    ],
  },
  { key: "pattern", label: "Pattern", max: 40, itemMax: 20, kind: "select", items: PATTERNS, minRows: 2 },
  { key: "step_sparring", label: "Step-Sparring", max: 10, itemMax: 10, kind: "select", items: STEP_SPARRING_ITEMS, minRows: 2 },
  {
    key: "sparring",
    label: "Sparring",
    max: 20,
    itemMax: 10,
    kind: "fixed",
    items: [
      { key: "round_1", label: "1st round" },
      { key: "round_2", label: "2nd round" },
      { key: "round_3", label: "3rd round" },
    ],
  },
  { key: "power_breaking", label: "Power Breaking", max: 10, itemMax: 5, kind: "breaking", items: [], methods: 3, attempts: 3 },
  {
    key: "attitude",
    label: "Attitude / Characteristic",
    max: 5,
    itemMax: 5,
    kind: "fixed",
    items: [{ key: "attitude", label: "Attitude / Characteristic" }],
  },
];

/**
 * How a technique ended: broken on one of three attempts, or not at all.
 * One outcome per technique, so these are a choice rather than a checklist.
 */
export const BREAKING_OUTCOMES = [
  { key: "1", label: "1st Attempt" },
  { key: "2", label: "2nd Attempt" },
  { key: "3", label: "3rd Attempt" },
  { key: "ftb", label: "FTB" },
] as const;

export type BreakingOutcome = (typeof BREAKING_OUTCOMES)[number]["key"];

/**
 * What one technique earns, given how many techniques the candidate is breaking.
 *
 *   1st attempt   9 / n
 *   2nd attempt   9 / (n + 1.5)
 *   3rd attempt   9 / (n + 3)
 *   FTB           nothing
 *
 * Each attempt steps the divisor by the same 1.5, so a later attempt always
 * scores less than an earlier one however many techniques are being broken.
 * (The earlier "n + n" did that for three techniques but inverted at one,
 * where a third attempt would have outscored a second.)
 *
 * First-time breaks come to 9 across the board, and the last mark is the bonus
 * below — so a clean sheet is worth exactly 10 and anything less can't reach it.
 */
export function breakingPoints(outcome: string, techniqueCount: number): number {
  const n = Math.max(1, techniqueCount);
  if (outcome === "1") return 9 / n;
  if (outcome === "2") return 9 / (n + 1.5);
  if (outcome === "3") return 9 / (n + 3);
  return 0;
}

/** The extra mark for breaking everything, however many attempts it took. */
export const BREAKING_BONUS = 1;

/**
 * A candidate at or above this passes; 49 and below fails.
 * The tick is set from the mark, and an examiner can still override it.
 */
export const PASS_MARK = 50;
export const REMARK_MAX = 300;

/** Individual marks and choices, keyed by item. */
export type SheetMarks = Record<string, any>;

/** One row of a "select" component: what was performed and what it scored. */
export type SelectedRow = { item: string; score: number | null };

export function selectedRows(marks: SheetMarks, component: SheetComponent): SelectedRow[] {
  const raw = marks?.[`${component.key}__rows`];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r: any) => ({ item: String(r.item ?? ""), score: numberOrNull(r.score) }));
}

function numberOrNull(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Read one mark, ignoring anything that isn't a usable number. */
export function markValue(marks: SheetMarks, key: string): number | null {
  return numberOrNull(marks?.[key]);
}

/** Keep a mark inside 0..max, or null when nothing has been entered. */
export function cleanMark(value: unknown, max: number): number | null {
  const n = numberOrNull(value);
  if (n == null) return null;
  return Math.min(Math.max(Math.round(n * 10) / 10, 0), max);
}

/** The label for one of a component's choices. */
export function itemLabel(component: SheetComponent, key: string): string {
  return component.items.find((i) => i.key === key)?.label ?? key;
}

/** What a component was awarded: its rows added up, capped at its Max. */
export function componentTotal(component: SheetComponent, marks: SheetMarks): number {
  let sum = 0;
  if (component.kind === "select") {
    sum = selectedRows(marks, component).reduce((t, r) => t + (r.item ? r.score ?? 0 : 0), 0);
  } else if (component.kind === "breaking") {
    const methods = component.methods ?? 3;
    // Only techniques that were actually chosen count towards the share, so a
    // candidate breaking two isn't marked as though they attempted three.
    const chosen: string[] = [];
    for (let m = 1; m <= methods; m++) {
      // Half-made picks don't count: "hand__" is somebody mid-choice, not a
      // technique they attempted.
      if (isCompleteBreakingValue(String(marks?.[`pb_method_${m}`] ?? ""))) chosen.push(`pb_outcome_${m}`);
    }
    const count = chosen.length;
    let allBroke = count > 0;
    for (const key of chosen) {
      const outcome = String(marks?.[key] ?? "");
      if (outcome === "" || outcome === "ftb") allBroke = false;
      sum += breakingPoints(outcome, count);
    }
    if (allBroke) sum += BREAKING_BONUS;
  } else {
    sum = component.items.reduce((t, item) => t + (markValue(marks, item.key) ?? 0), 0);
  }
  // Rounded here rather than per row: the exact shares rarely divide evenly,
  // and rounding each one first would quietly cost a mark.
  return Math.min(Math.round(sum), component.max);
}

/** The components a category is marked on. Empty or missing means all of them. */
export function componentsFor(
  keys: readonly string[] | null | undefined,
  sheet: SheetComponent[] = DEFAULT_SHEET,
): SheetComponent[] {
  if (!keys || keys.length === 0) return sheet;
  const wanted = new Set(keys);
  const chosen = sheet.filter((c) => wanted.has(c.key));
  return chosen.length > 0 ? chosen : sheet;
}

/** The candidate's mark out of 100. */
export function sheetTotal(marks: SheetMarks, components: SheetComponent[] = DEFAULT_SHEET): number {
  const sum = components.reduce((total, c) => total + componentTotal(c, marks), 0);
  return Math.round(sum * 10) / 10;
}

/** Whether the marks pass, before any examiner override. */
export function marksSayPassed(marks: SheetMarks, components: SheetComponent[] = DEFAULT_SHEET): boolean {
  return sheetTotal(marks, components) >= PASS_MARK;
}

/** How many rows have been marked, for a progress read on the picker. */
export function marksGiven(marks: SheetMarks, components: SheetComponent[] = DEFAULT_SHEET): number {
  let n = 0;
  for (const c of components) {
    if (c.kind === "select") {
      n += selectedRows(marks, c).filter((r) => r.item && r.score != null).length;
    } else if (c.kind === "breaking") {
      for (let m = 1; m <= (c.methods ?? 3); m++) {
        if (String(marks?.[`pb_outcome_${m}`] ?? "")) n++;
      }
    } else {
      n += c.items.filter((item) => markValue(marks, item.key) != null).length;
    }
  }
  return n;
}

/** Total number of markable rows, for "3 of 12" style progress. */
export function marksPossible(components: SheetComponent[] = DEFAULT_SHEET): number {
  return components.reduce((n, c) => {
    if (c.kind === "select") return n + (c.minRows ?? 2);
    if (c.kind === "breaking") return n + (c.methods ?? 3);
    return n + c.items.length;
  }, 0);
}

export function sheetMax(components: SheetComponent[] = DEFAULT_SHEET): number {
  return components.reduce((n, c) => n + c.max, 0);
}

export const SHEET_TOTAL_MAX = sheetMax(DEFAULT_SHEET); // 100

/**
 * Read a stored syllabus back into components, discarding anything malformed.
 *
 * A syllabus is edited by people, so it's treated as untrusted: a component
 * missing a key or a max is dropped rather than allowed to break marking.
 */
export function parseSheet(raw: unknown): SheetComponent[] {
  if (!Array.isArray(raw)) return DEFAULT_SHEET;
  const kinds: ComponentKind[] = ["fixed", "select", "breaking"];
  const parsed = raw
    .filter((c: any) => c && typeof c.key === "string" && c.key.trim())
    .map((c: any) => ({
      key: String(c.key).trim(),
      label: String(c.label ?? c.key).trim() || String(c.key),
      max: Math.max(0, Number(c.max) || 0),
      itemMax: Math.max(1, Number(c.itemMax) || 10),
      kind: (kinds.includes(c.kind) ? c.kind : "fixed") as ComponentKind,
      items: Array.isArray(c.items)
        ? c.items
            .filter((i: any) => i && typeof i.key === "string" && i.key.trim())
            .map((i: any) => ({ key: String(i.key).trim(), label: String(i.label ?? i.key).trim() || String(i.key) }))
        : [],
      minRows: c.minRows != null ? Math.max(1, Number(c.minRows) || 1) : undefined,
      methods: c.methods != null ? Math.max(1, Number(c.methods) || 1) : undefined,
      attempts: c.attempts != null ? Math.max(1, Number(c.attempts) || 1) : undefined,
    }));
  return parsed.length > 0 ? parsed : DEFAULT_SHEET;
}
