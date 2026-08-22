import { gradeLabel } from "./belts";
import { waiverAge, formatDob } from "./eligibility";
import { formatEventDateTime, formatEventRange } from "./eventStatus";
import {
  componentTotal,
  selectedRows,
  markValue,
  itemLabel,
  sheetTotal,
  sheetMax,
  marksSayPassed,
  type SheetComponent,
  type SheetMarks,
} from "./gradingSheet";
import { breakingLabel } from "./powerBreaking";

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
  | "participant.signature" | "participant.signedName" | "participant.signedDate"
  | "event.name" | "event.venue" | "event.dates" | "event.startTime" | "event.organizer"
  | "exam.total" | "exam.max" | "exam.result" | "exam.approvedRank" | "exam.remark"
  | "exam.examinerName" | "exam.examinerSignature"
  | "meta.today"
  // Components and their contents come from the event's own syllabus, so these
  // keys are built at runtime rather than listed here: exam.component.<key>
  // and exam.item.<key>.
  | (string & {});

/**
 * `image: true` marks a field that is drawn rather than typed. The signature is
 * the only one today: whatever the participant draws on their signing link is
 * scaled into the box the organiser positioned, so it lands in the same place
 * on every copy of the form.
 */
export const TEMPLATE_FIELDS: { key: TemplateFieldKey; label: string; group: string; image?: boolean }[] = [
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
  { key: "participant.signature", label: "Signature (drawn online)", group: "Signature", image: true },
  { key: "participant.signedName", label: "Name as signed", group: "Signature" },
  { key: "participant.signedDate", label: "Date signed", group: "Signature" },
  { key: "event.name", label: "Event name", group: "Event" },
  { key: "event.venue", label: "Venue", group: "Event" },
  { key: "event.dates", label: "Event dates", group: "Event" },
  { key: "event.startTime", label: "Start date & time", group: "Event" },
  { key: "event.organizer", label: "Organizer", group: "Event" },
  { key: "exam.total", label: "Total mark", group: "Exam result" },
  { key: "exam.max", label: "Marks available", group: "Exam result" },
  { key: "exam.result", label: "PASSED / FAILED", group: "Exam result" },
  { key: "exam.approvedRank", label: "Approved rank", group: "Exam result" },
  { key: "exam.remark", label: "Remarks", group: "Exam result" },
  { key: "exam.examinerName", label: "Examiner name", group: "Exam result" },
  { key: "exam.examinerSignature", label: "Examiner signature", group: "Exam result", image: true },
  { key: "meta.today", label: "Today's date", group: "Other" },
];

export type TemplateFieldDef = { key: string; label: string; group: string; image?: boolean };

/**
 * The fields a result form can place, including every component and content
 * column on this event's syllabus.
 *
 * Built from the syllabus rather than hard-coded, so adding a pattern in the
 * Exam Syllabus tab immediately makes it placeable on the printed form.
 */
export function examFieldsForSheet(sheet: SheetComponent[]): TemplateFieldDef[] {
  const out: TemplateFieldDef[] = [];
  for (const component of sheet) {
    out.push({
      key: `exam.component.${component.key}`,
      label: `${component.label} — alloted`,
      group: "Exam: components",
    });
    if (component.kind === "breaking") {
      const methods = component.methods ?? 3;
      for (let m = 1; m <= methods; m++) {
        out.push({ key: `exam.breaking.${m}.technique`, label: `Breaking ${m} — technique`, group: "Exam: power breaking" });
        out.push({ key: `exam.breaking.${m}.outcome`, label: `Breaking ${m} — outcome`, group: "Exam: power breaking" });
      }
      continue;
    }
    if (component.kind === "select" || component.kind === "mixed") {
      // The columns everybody sits print by name; the chosen ones print as a
      // name-and-mark pair, since which pattern lands in row 2 varies.
      for (const item of component.fixed ?? []) {
        out.push({ key: `exam.item.${item.key}`, label: `${item.label} — mark`, group: `Exam: ${component.label}` });
      }
      const rows = component.minRows ?? 2;
      for (let i = 1; i <= rows + 2; i++) {
        out.push({ key: `exam.row.${component.key}.${i}.name`, label: `${component.label} ${i} — name`, group: `Exam: ${component.label}` });
        out.push({ key: `exam.row.${component.key}.${i}.mark`, label: `${component.label} ${i} — mark`, group: `Exam: ${component.label}` });
      }
      continue;
    }
    for (const item of component.items) {
      out.push({ key: `exam.item.${item.key}`, label: `${item.label} — mark`, group: `Exam: ${component.label}` });
    }
  }
  return out;
}

/** Everything a result form can place: the standard fields plus the syllabus. */
export function catalogueFor(sheet: SheetComponent[] | null): TemplateFieldDef[] {
  if (!sheet) return TEMPLATE_FIELDS as TemplateFieldDef[];
  return [...(TEMPLATE_FIELDS as TemplateFieldDef[]), ...examFieldsForSheet(sheet)];
}

export type TemplateData = {
  participant: {
    fullName?: string | null;
    nationalId?: string | null;
    birthday?: string | null; gender?: string | null;
    clubName?: string | null; instructor?: string | null;
    gup?: number | null; dan?: number | null;
    email?: string | null; nationality?: string | null;
    weightKg?: number | null; heightCm?: number | null;
    /** Data URL captured on the signing link, drawn into any signature box. */
    signaturePng?: string | null;
    signedName?: string | null; signedAt?: string | null;
  } | null;
  event: {
    name?: string | null; venue?: string | null; venueAddress?: string | null;
    country?: string | null; startDate?: string | null; endDate?: string | null;
    organizer?: string | null;
  };
  /** Present only on result forms. */
  exam?: {
    sheet: SheetComponent[];
    /** The components this candidate's category was marked on. */
    components: SheetComponent[];
    marks: SheetMarks;
    total: number;
    passed: boolean;
    approvedRank?: string | null;
    remark?: string | null;
    examinerName?: string | null;
    examinerSignature?: string | null;
  } | null;
};

/**
 * Fields whose names are built from the syllabus rather than listed up front.
 *
 * Anything unrecognised prints as empty: a form drawn against an older syllabus
 * loses the boxes that no longer mean anything rather than printing raw keys.
 */
function resolveExamField(key: string, data: TemplateData): string {
  const x = data.exam;
  if (!x) return "";

  const component = (k: string) => x.sheet.find((c) => c.key === k);

  if (key.startsWith("exam.component.")) {
    const c = component(key.slice("exam.component.".length));
    if (!c) return "";
    // A component the candidate didn't sit prints blank, not zero.
    if (!x.components.some((inPlay) => inPlay.key === c.key)) return "";
    return String(componentTotal(c, x.marks));
  }

  if (key.startsWith("exam.item.")) {
    const v = markValue(x.marks, key.slice("exam.item.".length));
    return v == null ? "" : String(v);
  }

  if (key.startsWith("exam.row.")) {
    // exam.row.<component>.<n>.<name|mark>
    const [, , componentKey, indexText, part] = key.split(".");
    const c = component(componentKey);
    if (!c) return "";
    const rows = selectedRows(x.marks, c);
    const row = rows[Number(indexText) - 1];
    if (!row || !row.item) return "";
    if (part === "name") return itemLabel(c, row.item);
    return row.score == null ? "" : String(row.score);
  }

  if (key.startsWith("exam.breaking.")) {
    const [, , indexText, part] = key.split(".");
    const m = Number(indexText);
    if (!Number.isFinite(m)) return "";
    if (part === "technique") return breakingLabel(String(x.marks?.[`pb_method_${m}`] ?? ""));
    const outcome = String(x.marks?.[`pb_outcome_${m}`] ?? "");
    if (!outcome) return "";
    return outcome === "ftb" ? "FTB" : `${outcome}${outcome === "1" ? "st" : outcome === "2" ? "nd" : "rd"} attempt`;
  }

  return "";
}

/** The text to print for one field. Missing data prints as empty, never "null". */
export function resolveTemplateField(key: string, data: TemplateData): string {
  const p = data.participant;
  const e = data.event;
  const x = data.exam;
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
    // Drawn, not typed — fillTemplate handles this one and never asks for text.
    case "participant.signature": return "";
    case "participant.signedName": return p?.signedName ?? "";
    case "participant.signedDate": return p?.signedAt ? formatEventDateTime(p.signedAt, false) : "";
    case "event.name": return e.name ?? "";
    case "event.venue": return [e.venue, e.venueAddress, e.country].filter(Boolean).join(", ");
    case "event.dates": return formatEventRange(e.startDate ?? null, e.endDate ?? null);
    case "event.startTime": return formatEventDateTime(e.startDate ?? null);
    case "event.organizer": return e.organizer ?? "";
    case "meta.today": return formatEventDateTime(new Date().toISOString(), false);
    case "exam.total": return x ? String(x.total) : "";
    case "exam.max": return x ? String(sheetMax(x.components)) : "";
    case "exam.result": return x ? (x.passed ? "PASSED" : "FAILED") : "";
    case "exam.approvedRank": return x?.approvedRank ?? "";
    case "exam.remark": return x?.remark ?? "";
    case "exam.examinerName": return x?.examinerName ?? "";
    // Drawn, not typed — fillTemplate handles the image fields.
    case "exam.examinerSignature": return "";
    default: return resolveExamField(key, data);
  }
}

/** True for fields drawn as a picture, which have no text size or alignment. */
export function isImageField(key: string): boolean {
  return TEMPLATE_FIELDS.some((f) => f.key === key && f.image) || key === "exam.examinerSignature";
}

/** The picture a drawn field should print. */
export function imageForField(key: string, data: TemplateData): string | null {
  if (key === "exam.examinerSignature") return data.exam?.examinerSignature ?? null;
  return data.participant?.signaturePng ?? null;
}

/** Stand-in values so the designer can show a realistic preview. */
export const SAMPLE_DATA: TemplateData = {
  participant: {
    fullName: "WEI TAN", nationalId: "S1234567D",
    birthday: "2001-04-12", gender: "male", clubName: "Dragon TKD", instructor: "Mr Lim",
    gup: 4, dan: null, email: "wei@example.com", nationality: "Singapore",
    weightKg: 62.5, heightCm: 170,
    signaturePng: null, signedName: "WEI TAN", signedAt: new Date().toISOString(),
  },
  event: {
    name: "Sample Event", venue: "Sports Hall", venueAddress: "1 Stadium Drive",
    country: "Singapore", startDate: new Date().toISOString(), endDate: null, organizer: "Dragon TKD",
  },
  exam: null,
};
