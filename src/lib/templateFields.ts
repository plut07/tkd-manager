import { gradeLabel } from "./belts";
import { waiverAge, formatDob } from "./eligibility";
import { formatEventDateTime, formatEventRange } from "./eventStatus";

/**
 * The data a form template can place on a page.
 *
 * Keys are stored in the database against each box the user draws, so renaming
 * one would orphan existing templates — add new keys rather than changing these.
 */
export type TemplateFieldKey =
  | "participant.name"
  | "participant.ic" | "participant.age" | "participant.dob" | "participant.gender"
  | "participant.club" | "participant.grade" | "participant.instructor"
  | "participant.email" | "participant.nationality" | "participant.weight" | "participant.height"
  | "event.name" | "event.venue" | "event.dates" | "event.startTime" | "event.organizer"
  | "meta.today";

export const TEMPLATE_FIELDS: { key: TemplateFieldKey; label: string; group: string }[] = [
  { key: "participant.name", label: "Full name", group: "Participant" },

  { key: "participant.ic", label: "NRIC / Passport ID", group: "Participant" },
  { key: "participant.age", label: "Age", group: "Participant" },
  { key: "participant.dob", label: "Date of birth", group: "Participant" },
  { key: "participant.gender", label: "Gender", group: "Participant" },
  { key: "participant.grade", label: "Grade / Degree", group: "Participant" },
  { key: "participant.club", label: "Club / Training centre", group: "Participant" },
  { key: "participant.instructor", label: "Instructor", group: "Participant" },
  { key: "participant.nationality", label: "Nationality", group: "Participant" },
  { key: "participant.email", label: "Email", group: "Participant" },
  { key: "participant.weight", label: "Weight (kg)", group: "Participant" },
  { key: "participant.height", label: "Height (cm)", group: "Participant" },
  { key: "event.name", label: "Event name", group: "Event" },
  { key: "event.venue", label: "Venue", group: "Event" },
  { key: "event.dates", label: "Event dates", group: "Event" },
  { key: "event.startTime", label: "Start date & time", group: "Event" },
  { key: "event.organizer", label: "Organizer", group: "Event" },
  { key: "meta.today", label: "Today's date", group: "Other" },
];

export type TemplateData = {
  participant: {
    fullName?: string | null;
    nationalId?: string | null;
    birthday?: string | null; gender?: string | null;
    clubName?: string | null; instructor?: string | null;
    gup?: number | null; dan?: number | null;
    email?: string | null; nationality?: string | null;
    weightKg?: number | null; heightCm?: number | null;
  } | null;
  event: {
    name?: string | null; venue?: string | null; venueAddress?: string | null;
    country?: string | null; startDate?: string | null; endDate?: string | null;
    organizer?: string | null;
  };
};

/** The text to print for one field. Missing data prints as empty, never "null". */
export function resolveTemplateField(key: string, data: TemplateData): string {
  const p = data.participant;
  const e = data.event;
  switch (key) {
    case "participant.name": return p?.fullName ?? "";

    case "participant.ic": return (p?.nationalId || "") as string;
    case "participant.age": return waiverAge(p?.birthday ?? null);
    case "participant.dob": { const v = formatDob(p?.birthday ?? null); return v === "—" ? "" : v; }
    case "participant.gender": return (p?.gender ?? "").toUpperCase();
    case "participant.grade": { const v = gradeLabel(p?.gup ?? null, p?.dan ?? null); return v === "—" ? "" : v; }
    case "participant.club": return p?.clubName ?? "";
    case "participant.instructor": return p?.instructor ?? "";
    case "participant.nationality": return p?.nationality ?? "";
    case "participant.email": return p?.email ?? "";
    case "participant.weight": return p?.weightKg != null ? String(p.weightKg) : "";
    case "participant.height": return p?.heightCm != null ? String(p.heightCm) : "";
    case "event.name": return e.name ?? "";
    case "event.venue": return [e.venue, e.venueAddress, e.country].filter(Boolean).join(", ");
    case "event.dates": return formatEventRange(e.startDate ?? null, e.endDate ?? null);
    case "event.startTime": return formatEventDateTime(e.startDate ?? null);
    case "event.organizer": return e.organizer ?? "";
    case "meta.today": return formatEventDateTime(new Date().toISOString(), false);
    default: return "";
  }
}

/** Stand-in values so the designer can show a realistic preview. */
export const SAMPLE_DATA: TemplateData = {
  participant: {
    fullName: "WEI TAN", nationalId: "S1234567D",
    birthday: "2001-04-12", gender: "male", clubName: "Dragon TKD", instructor: "Mr Lim",
    gup: 4, dan: null, email: "wei@example.com", nationality: "Singapore",
    weightKg: 62.5, heightCm: 170,
  },
  event: {
    name: "Sample Event", venue: "Sports Hall", venueAddress: "1 Stadium Drive",
    country: "Singapore", startDate: new Date().toISOString(), endDate: null, organizer: "Dragon TKD",
  },
};
