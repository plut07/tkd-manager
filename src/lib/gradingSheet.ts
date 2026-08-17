/**
 * The federation's grading sheet, as data.
 *
 * Six components, each with its own sub-columns and its own share of the 100
 * marks — the same shape as the printed form:
 *
 *   Fundamental      Hand / Foot Techniques                        15
 *   Pattern          Saju Jirugi ... Choong-Moo                    40
 *   Step-Sparring    Sambo Matsogi, Ilbo Matsogi, Self Defence     10
 *   Sparring         1st, 2nd, 3rd round                           20
 *   Power Breaking   3 methods x 3 attempts                        10
 *   Attitude / Characteristic                                       5
 *
 * A component's Alloted mark is the sum of its columns, capped at its Max — an
 * examiner filling in generous individual marks can't push a component past its
 * share of the paper.
 *
 * Deliberately plain: no server-only or database imports, so the same
 * definitions drive the marking screen, the save, the result list and the PDF.
 */

export type SheetItem = { key: string; label: string };

export type SheetComponent = {
  key: string;
  label: string;
  /** This component's share of the 100 marks. */
  max: number;
  /** The most any single column may be given. */
  itemMax: number;
  items: SheetItem[];
  /** Power breaking also records what was broken, not just the marks. */
  methodRows?: { key: string; label: string }[];
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

const BREAKING_ITEMS: SheetItem[] = [1, 2, 3].flatMap((method) =>
  [1, 2, 3].map((attempt) => ({
    key: `pb_m${method}_a${attempt}`,
    label: `Method ${method}, attempt ${attempt}`,
  })),
);

export const SHEET: SheetComponent[] = [
  {
    key: "fundamental",
    label: "Fundamental",
    max: 15,
    itemMax: 15,
    items: [
      { key: "hand_techniques", label: "Hand Techniques" },
      { key: "foot_techniques", label: "Foot Techniques" },
    ],
  },
  { key: "pattern", label: "Pattern", max: 40, itemMax: 20, items: PATTERNS },
  {
    key: "step_sparring",
    label: "Step-Sparring",
    max: 10,
    itemMax: 10,
    items: [
      { key: "sambo_matsogi", label: "Sambo Matsogi" },
      { key: "ilbo_matsogi", label: "Ilbo Matsogi" },
      { key: "self_defence", label: "Self Defence" },
    ],
  },
  {
    key: "sparring",
    label: "Sparring",
    max: 20,
    itemMax: 10,
    items: [
      { key: "round_1", label: "1st round" },
      { key: "round_2", label: "2nd round" },
      { key: "round_3", label: "3rd round" },
    ],
  },
  {
    key: "power_breaking",
    label: "Power Breaking",
    max: 10,
    itemMax: 5,
    items: BREAKING_ITEMS,
    methodRows: [
      { key: "pb_method_1", label: "1" },
      { key: "pb_method_2", label: "2" },
      { key: "pb_method_3", label: "3" },
    ],
  },
  {
    key: "attitude",
    label: "Attitude / Characteristic",
    max: 5,
    itemMax: 5,
    items: [{ key: "attitude", label: "Attitude / Characteristic" }],
  },
];

/** The three columns the breaking grid is laid out in. */
export const BREAKING_ATTEMPTS = ["1st Attempt", "2nd Attempt", "3rd Attempt"];

export const SHEET_TOTAL_MAX = SHEET.reduce((sum, c) => sum + c.max, 0); // 100

/**
 * A candidate at or above this passes.
 *
 * One number, in one place, because it's the sort of thing a federation
 * revisits. Anything below it fails unless an examiner overrides.
 */
export const PASS_MARK = 49;

/** Individual marks, keyed by item. Free-text method names live here too. */
export type SheetMarks = Record<string, number | string | null>;

export function componentByKey(key: string): SheetComponent | undefined {
  return SHEET.find((c) => c.key === key);
}

/** Read one mark, ignoring anything that isn't a usable number. */
export function markValue(marks: SheetMarks, key: string): number | null {
  const raw = marks?.[key];
  if (raw === "" || raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Keep a mark inside 0..max, or null when nothing has been entered. */
export function cleanMark(value: unknown, max: number): number | null {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(Math.round(n * 10) / 10, 0), max);
}

/** What a component was awarded: its columns added up, capped at its Max. */
export function componentTotal(component: SheetComponent, marks: SheetMarks): number {
  const sum = component.items.reduce((total, item) => total + (markValue(marks, item.key) ?? 0), 0);
  return Math.min(Math.round(sum * 10) / 10, component.max);
}

/** Whether any mark has been entered for a component. */
export function componentStarted(component: SheetComponent, marks: SheetMarks): boolean {
  return component.items.some((item) => markValue(marks, item.key) != null);
}

/** The components a category is marked on. Empty or missing means all of them. */
export function componentsFor(keys: readonly string[] | null | undefined): SheetComponent[] {
  if (!keys || keys.length === 0) return SHEET;
  const wanted = new Set(keys);
  const chosen = SHEET.filter((c) => wanted.has(c.key));
  return chosen.length > 0 ? chosen : SHEET;
}

/** The candidate's mark out of 100. */
export function sheetTotal(marks: SheetMarks, components: SheetComponent[] = SHEET): number {
  const sum = components.reduce((total, c) => total + componentTotal(c, marks), 0);
  return Math.round(sum * 10) / 10;
}

/** Whether the marks alone pass, before any examiner override. */
export function marksSayPassed(marks: SheetMarks, components: SheetComponent[] = SHEET): boolean {
  return sheetTotal(marks, components) >= PASS_MARK;
}

/** How many columns have been marked, for a progress read on the picker. */
export function marksGiven(marks: SheetMarks, components: SheetComponent[] = SHEET): number {
  return components.reduce(
    (n, c) => n + c.items.filter((item) => markValue(marks, item.key) != null).length,
    0,
  );
}

/** Total number of columns for the components in play. */
export function marksPossible(components: SheetComponent[] = SHEET): number {
  return components.reduce((n, c) => n + c.items.length, 0);
}

export const REMARK_MAX = 300;
