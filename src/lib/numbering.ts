// Auto-generated competition numbering for confirmed competitors, scoped to
// a single event (numbers are meaningless outside that event and get
// recomputed for the whole event whenever the confirmed list changes).
import { computeAge } from "./eligibility";

export type NumberingStudent = {
  registrationId: string;
  birthday: string | null;
  gender: string | null;
  gup: number | null;
  dan: number | null;
};

// Gup (colored belt) competitors sort first, highest gup number to lowest
// (e.g. Gup 10 before Gup 1 — beginners first), then Dan (black belt)
// competitors sort lowest to highest (1st Dan before 9th Dan).
function gradeSortKey(gup: number | null, dan: number | null): number {
  if (gup != null) return 100 - gup;
  if (dan != null) return 200 + dan;
  return 999;
}

// Male, then female, then unspecified/other.
function genderSortKey(gender: string | null): number {
  if (gender === "male") return 0;
  if (gender === "female") return 1;
  return 2;
}

export function sortForNumbering(students: NumberingStudent[]): NumberingStudent[] {
  return [...students].sort((a, b) => {
    const ageA = computeAge(a.birthday) ?? 999;
    const ageB = computeAge(b.birthday) ?? 999;
    if (ageA !== ageB) return ageA - ageB;
    const genderA = genderSortKey(a.gender);
    const genderB = genderSortKey(b.gender);
    if (genderA !== genderB) return genderA - genderB;
    return gradeSortKey(a.gup, a.dan) - gradeSortKey(b.gup, b.dan);
  });
}

/** 1-based index -> "01001", "01002", ... "01999", "02000", ... */
export function formatCompetitionNumber(index: number): string {
  return String(1000 + index).padStart(5, "0");
}
