/**
 * ITF colour belts. Gup counts *down*: a beginner is 10th gup (white) and the
 * most senior colour belt is 1st gup (red with black tip).
 *
 * The database stores the number — it sorts and filters correctly, and every
 * existing record already uses it. The colour name is presentation only, so
 * this file is the single place the two are tied together.
 */

export type Belt = { gup: number; label: string; short: string; swatch: string };

export const BELTS: Belt[] = [
  { gup: 1, label: "Red Black / Black Tip", short: "Red–Black", swatch: "linear-gradient(180deg,#dc2626 0 55%,#111827 55% 100%)" },
  { gup: 2, label: "Red", short: "Red", swatch: "#dc2626" },
  { gup: 3, label: "Blue Red / Red Tip", short: "Blue–Red", swatch: "linear-gradient(180deg,#2563eb 0 55%,#dc2626 55% 100%)" },
  { gup: 4, label: "Blue", short: "Blue", swatch: "#2563eb" },
  { gup: 5, label: "Green Blue / Blue Tip", short: "Green–Blue", swatch: "linear-gradient(180deg,#16a34a 0 55%,#2563eb 55% 100%)" },
  { gup: 6, label: "Green", short: "Green", swatch: "#16a34a" },
  { gup: 7, label: "Yellow Green / Green Tip", short: "Yellow–Green", swatch: "linear-gradient(180deg,#eab308 0 55%,#16a34a 55% 100%)" },
  { gup: 8, label: "Yellow", short: "Yellow", swatch: "#eab308" },
  { gup: 9, label: "White Yellow / Yellow Tip", short: "White–Yellow", swatch: "linear-gradient(180deg,#f8fafc 0 55%,#eab308 55% 100%)" },
  { gup: 10, label: "White", short: "White", swatch: "#f8fafc" },
];

const BY_GUP = new Map(BELTS.map((b) => [b.gup, b]));

export function beltForGup(gup: number | null | undefined): Belt | null {
  if (gup == null) return null;
  return BY_GUP.get(Number(gup)) ?? null;
}

/**
 * How a grade reads on screen. Dan grades outrank every colour belt, so they
 * take priority when a record somehow has both.
 */
export function gradeLabel(gup: number | null | undefined, dan: number | null | undefined): string {
  if (dan != null) {
    const n = Number(dan);
    const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
    return `${n}${suffix} Dan (Black belt)`;
  }
  const belt = beltForGup(gup);
  if (belt) return `${belt.label} (${belt.gup} Gup)`;
  return "—";
}

/** Compact form for tables where the full colour name is too long. */
export function gradeShort(gup: number | null | undefined, dan: number | null | undefined): string {
  if (dan != null) return `${dan} Dan`;
  const belt = beltForGup(gup);
  return belt ? `${belt.short} (${belt.gup})` : "—";
}

/** Belt names exactly as they appear in the Tally dropdown, senior first. */
export const BELT_OPTIONS: string[] = BELTS.map((b) => b.label);

/** Parse a belt name back to its gup number, for spreadsheet and form intake. */
export function gupFromLabel(value: string | null | undefined): number | null {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return null;
  const direct = BELTS.find((b) => b.label.toLowerCase() === v || b.short.toLowerCase() === v);
  if (direct) return direct.gup;
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
}
