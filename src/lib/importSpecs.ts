import { findCountry } from "./countries";
import { gupFromLabel, BELT_OPTIONS } from "./belts";

/**
 * Column definitions and validation for spreadsheet imports.
 *
 * Validation deliberately mirrors the on-screen forms — an import must not be
 * able to create a record the form would have rejected. Rows are validated
 * independently so one bad line never stops the rest of the file.
 */

export type ColumnSpec = { header: string; required?: boolean; example: string; note?: string };

export type RowError = { row: number; column: string; value: string; problem: string };

export type ImportOutcome<T> = {
  create: { row: number; data: T; label: string }[];
  update: { row: number; data: T; label: string; existingId: string }[];
  errors: RowError[];
};

export const STUDENT_COLUMNS: ColumnSpec[] = [
  { header: "Club", required: true, example: "Dragon TKD", note: "Must already exist in Clubs" },
  { header: "First name", required: true, example: "WEI", note: "Saved in CAPITALS" },
  { header: "Last name", required: true, example: "TAN", note: "Saved in CAPITALS" },
  { header: "Email", example: "wei@example.com" },
  { header: "Birthday", example: "2001-04-12", note: "YYYY-MM-DD" },
  { header: "Gender", example: "male", note: "male, female or other" },
  { header: "Weight (kg)", example: "62.5" },
  { header: "Height (cm)", example: "170" },
  { header: "Gup", example: "Blue", note: "Belt colour or 1-10, blank if black belt" },
  { header: "Dan", example: "", note: "1-9, blank if not black belt" },
  { header: "Nationality", example: "Singapore" },
  { header: "ID number", required: true, example: "S1234567D", note: "Used to detect duplicates" },
  { header: "Passport ID", example: "" },
  { header: "Active", example: "yes", note: "yes or no" },
];

export const CLUB_COLUMNS: ColumnSpec[] = [
  { header: "Name", required: true, example: "Dragon TKD", note: "Used to detect duplicates" },
  { header: "City", example: "Singapore" },
  { header: "Country", example: "Singapore" },
  { header: "Contact email", example: "info@dragontkd.com" },
  { header: "Contact phone", example: "+65 9123 4567" },
];

export type StudentRow = {
  club_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  birthday: string | null;
  gender: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  gup: number | null;
  dan: number | null;
  nationality: string | null;
  national_id: string | null;
  passport_id: string | null;
  active: boolean;
};

export type ClubRow = {
  name: string;
  city: string | null;
  country: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  active: boolean;
};

const norm = (s: string | undefined | null) => (s ?? "").trim();
const lower = (s: string | undefined | null) => norm(s).toLowerCase();

function optionalNumber(raw: string, min: number, max: number, column: string, row: number, errors: RowError[]): number | null {
  const v = norm(raw);
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    errors.push({ row, column, value: v, problem: "Not a number" });
    return null;
  }
  if (n < min || n > max) {
    errors.push({ row, column, value: v, problem: `Must be between ${min} and ${max}` });
    return null;
  }
  return n;
}

function parseBoolean(raw: string, fallback = true): boolean {
  const v = lower(raw);
  if (!v) return fallback;
  return ["yes", "y", "true", "1", "active"].includes(v);
}

function parseDate(raw: string, column: string, row: number, errors: RowError[]): string | null {
  const v = norm(raw);
  if (!v) return null;
  // Accept YYYY-MM-DD, plus DD/MM/YYYY and DD-MM-YYYY which Excel users type.
  let iso: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) iso = v;
  else {
    const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (!iso || Number.isNaN(new Date(iso).getTime())) {
    errors.push({ row, column, value: v, problem: "Use YYYY-MM-DD (e.g. 2001-04-12)" });
    return null;
  }
  return iso;
}

/**
 * Validate student rows against the clubs that exist and the students already
 * on file. Matching is by ID number, which is why that column is required.
 */
export function validateStudentRows(
  rows: Record<string, string>[],
  rowNumbers: number[],
  clubsByName: Map<string, string>,
  existingByNationalId: Map<string, string>,
  forcedClubId: string | null,
): ImportOutcome<StudentRow> {
  const out: ImportOutcome<StudentRow> = { create: [], update: [], errors: [] };
  const seen = new Map<string, number>();

  rows.forEach((raw, i) => {
    const row = rowNumbers[i];
    const errors: RowError[] = [];

    const firstName = norm(raw["First name"]).toUpperCase();
    const lastName = norm(raw["Last name"]).toUpperCase();
    const nationalId = norm(raw["ID number"]);
    if (!firstName) errors.push({ row, column: "First name", value: "", problem: "Required" });
    if (!lastName) errors.push({ row, column: "Last name", value: "", problem: "Required" });
    if (!nationalId) errors.push({ row, column: "ID number", value: "", problem: "Required — used to detect duplicates" });

    let clubId = forcedClubId;
    if (!clubId) {
      const clubName = norm(raw["Club"]);
      if (!clubName) errors.push({ row, column: "Club", value: "", problem: "Required" });
      else {
        const found = clubsByName.get(clubName.toLowerCase());
        if (!found) errors.push({ row, column: "Club", value: clubName, problem: "No club with this name — add it first or fix the spelling" });
        else clubId = found;
      }
    }

    const email = norm(raw["Email"]);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row, column: "Email", value: email, problem: "Not a valid email address" });
    }

    const gender = lower(raw["Gender"]);
    if (gender && !["male", "female", "other"].includes(gender)) {
      errors.push({ row, column: "Gender", value: raw["Gender"], problem: "Use male, female or other" });
    }

    const nationality = norm(raw["Nationality"]);
    if (nationality && !findCountry(nationality)) {
      errors.push({ row, column: "Nationality", value: nationality, problem: "Unknown country name" });
    }

    const birthday = parseDate(raw["Birthday"] ?? "", "Birthday", row, errors);
    const weight = optionalNumber(raw["Weight (kg)"] ?? "", 1, 300, "Weight (kg)", row, errors);
    const height = optionalNumber(raw["Height (cm)"] ?? "", 50, 260, "Height (cm)", row, errors);
    // The Gup column takes either the number or the belt colour name, since the
    // export writes numbers but people type colours.
    let gup: number | null = null;
    const gupRaw = norm(raw["Gup"]);
    if (gupRaw) {
      gup = gupFromLabel(gupRaw);
      if (gup == null) errors.push({ row, column: "Gup", value: gupRaw, problem: `Use 1-10 or a belt name (${BELT_OPTIONS[0]}, ...)` });
    }
    const dan = optionalNumber(raw["Dan"] ?? "", 1, 9, "Dan", row, errors);

    // A duplicate inside the file itself would otherwise import twice.
    if (nationalId) {
      const key = nationalId.toLowerCase();
      const earlier = seen.get(key);
      if (earlier) errors.push({ row, column: "ID number", value: nationalId, problem: `Same ID appears on row ${earlier} of this file` });
      else seen.set(key, row);
    }

    if (errors.length > 0) {
      out.errors.push(...errors);
      return;
    }

    const data: StudentRow = {
      club_id: clubId as string,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      birthday,
      gender: gender || null,
      weight_kg: weight,
      height_cm: height,
      gup,
      dan,
      nationality: nationality ? findCountry(nationality)!.name : null,
      national_id: nationalId || null,
      passport_id: norm(raw["Passport ID"]) || null,
      active: parseBoolean(raw["Active"] ?? ""),
    };

    const label = `${firstName} ${lastName}`;
    const existingId = existingByNationalId.get(nationalId.toLowerCase());
    if (existingId) out.update.push({ row, data, label, existingId });
    else out.create.push({ row, data, label });
  });

  return out;
}

/** Validate club rows. Matching is by club name. */
export function validateClubRows(
  rows: Record<string, string>[],
  rowNumbers: number[],
  existingByName: Map<string, string>,
): ImportOutcome<ClubRow> {
  const out: ImportOutcome<ClubRow> = { create: [], update: [], errors: [] };
  const seen = new Map<string, number>();

  rows.forEach((raw, i) => {
    const row = rowNumbers[i];
    const errors: RowError[] = [];

    const name = norm(raw["Name"]);
    if (!name) errors.push({ row, column: "Name", value: "", problem: "Required" });
    if (name.length === 1) errors.push({ row, column: "Name", value: name, problem: "Too short" });

    const email = norm(raw["Contact email"]);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row, column: "Contact email", value: email, problem: "Not a valid email address" });
    }

    const country = norm(raw["Country"]);
    if (country && !findCountry(country)) {
      errors.push({ row, column: "Country", value: country, problem: "Unknown country name" });
    }

    if (name) {
      const key = name.toLowerCase();
      const earlier = seen.get(key);
      if (earlier) errors.push({ row, column: "Name", value: name, problem: `Same club appears on row ${earlier} of this file` });
      else seen.set(key, row);
    }

    if (errors.length > 0) {
      out.errors.push(...errors);
      return;
    }

    const data: ClubRow = {
      name,
      city: norm(raw["City"]) || null,
      country: country ? findCountry(country)!.name : null,
      contact_email: email || null,
      contact_phone: norm(raw["Contact phone"]) || null,
      active: true,
    };

    const existingId = existingByName.get(name.toLowerCase());
    if (existingId) out.update.push({ row, data, label: name, existingId });
    else out.create.push({ row, data, label: name });
  });

  return out;
}
