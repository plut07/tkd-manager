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

// ---------------------------------------------------------------------------
// Unified grade scale
//
// Colour belts and black belts are one ladder to a student, so the UI offers a
// single "Current Grade / Degree" list running from White up to 7th Dan. The
// database still keeps gup and dan in separate columns — splitting them here
// rather than migrating avoids touching every existing query, and the two can
// never disagree because only this file writes them.
//
// Values are encoded as G10..G1 for gups and D1..D7 for dans.
// ---------------------------------------------------------------------------

export const MAX_DAN = 7;

export type GradeOption = { value: string; label: string; gup: number | null; dan: number | null };

function danLabel(n: number): string {
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `${n}${suffix} Dan`;
}

/** Beginner first, most senior last — the order the federation lists them in. */
export const GRADE_OPTIONS: GradeOption[] = [
  ...[...BELTS].sort((a, b) => b.gup - a.gup).map((b) => ({ value: `G${b.gup}`, label: b.label, gup: b.gup, dan: null })),
  ...Array.from({ length: MAX_DAN }, (_, i) => i + 1).map((n) => ({ value: `D${n}`, label: danLabel(n), gup: null, dan: n })),
];

const GRADE_BY_VALUE = new Map(GRADE_OPTIONS.map((g) => [g.value, g]));
const GRADE_BY_LABEL = new Map(GRADE_OPTIONS.map((g) => [g.label.trim().toLowerCase(), g]));

/** The dropdown value for a stored gup/dan pair. Dan wins if both are set. */
export function gradeValue(gup: number | null | undefined, dan: number | null | undefined): string {
  if (dan != null) return `D${Number(dan)}`;
  if (gup != null) return `G${Number(gup)}`;
  return "";
}

/** Split a dropdown value back into the two columns the database stores. */
export function parseGradeValue(value: string | null | undefined): { gup: number | null; dan: number | null } {
  const v = (value ?? "").trim().toUpperCase();
  const found = GRADE_BY_VALUE.get(v);
  if (found) return { gup: found.gup, dan: found.dan };
  return { gup: null, dan: null };
}

/**
 * Resolve a grade written as text — a form answer, a spreadsheet cell, or a
 * legacy gup number. Returns nulls when it can't be read, so a bad value
 * becomes "no grade" rather than a wrong one.
 */
export function parseGradeText(value: string | null | undefined): { gup: number | null; dan: number | null } {
  const raw = (value ?? "").trim();
  if (!raw) return { gup: null, dan: null };
  const byLabel = GRADE_BY_LABEL.get(raw.toLowerCase());
  if (byLabel) return { gup: byLabel.gup, dan: byLabel.dan };

  const short = BELTS.find((b) => b.short.toLowerCase() === raw.toLowerCase());
  if (short) return { gup: short.gup, dan: null };

  const dan = raw.match(/^(\d)\s*(?:st|nd|rd|th)?\s*dan$/i);
  if (dan) return { gup: null, dan: Number(dan[1]) };

  const gup = raw.match(/^(\d{1,2})\s*gup$/i);
  if (gup) return { gup: Number(gup[1]), dan: null };

  const bare = Number(raw);
  if (Number.isFinite(bare) && bare >= 1 && bare <= 10) return { gup: bare, dan: null };

  return { gup: null, dan: null };
}

/** Every grade label, beginner first — used to build the Tally dropdown. */
export const GRADE_LABELS: string[] = GRADE_OPTIONS.map((g) => g.label);
