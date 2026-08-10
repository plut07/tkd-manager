import "server-only";
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import { GRADE_LABELS, parseGradeText } from "./belts";

const TALLY_API = "https://api.tally.so";

function getApiKey() {
  const key = process.env.TALLY_API_KEY;
  if (!key) throw new Error("Tally integration isn't configured yet. Set TALLY_API_KEY in the project's environment variables.");
  return key;
}

function getBaseUrl() {
  const url = process.env.APP_BASE_URL;
  if (!url) throw new Error("Set APP_BASE_URL (e.g. https://tkd-manager-tkdtta.vercel.app) so the Tally webhook knows where to send responses.");
  return url.replace(/\/$/, "");
}

async function tallyFetch(path: string, init: RequestInit) {
  const res = await fetch(`${TALLY_API}${path}`, { ...init, headers: { Authorization: `Bearer ${getApiKey()}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (!res.ok) { const text = await res.text().catch(() => ""); throw new Error(`Tally API error (${res.status}): ${text || res.statusText}`); }
  return res.json();
}

type InputType = "INPUT_TEXT" | "INPUT_EMAIL" | "INPUT_DATE" | "INPUT_NUMBER";
type FieldSpec =
  | { label: string; kind: "input"; type: InputType; required: boolean }
  | { label: string; kind: "dropdown"; required: boolean; options: string[] };

/** Options the form offers, pulled from the database when the form is built. */
export type FormOptions = { clubs: string[]; countries: string[] };

// Labels are the contract between the form and the importer — parseTallyFields
// matches on them, so changing one here means changing the matcher below.
function buildFields(options: FormOptions): FieldSpec[] {
  const fields: FieldSpec[] = [
    { label: "First name", kind: "input", type: "INPUT_TEXT", required: true },
    { label: "Last name", kind: "input", type: "INPUT_TEXT", required: true },
    { label: "Email", kind: "input", type: "INPUT_EMAIL", required: false },
    { label: "Date of birth", kind: "input", type: "INPUT_DATE", required: false },
    { label: "Gender (male, female or other)", kind: "input", type: "INPUT_TEXT", required: false },
    { label: "Weight (kg)", kind: "input", type: "INPUT_NUMBER", required: false },
    { label: "Height (cm)", kind: "input", type: "INPUT_NUMBER", required: false },
    ...(GRADE_LABELS.length > 0
      ? ([{ label: "Current Grade / Degree", kind: "dropdown", required: true, options: GRADE_LABELS }] as FieldSpec[])
      : ([] as FieldSpec[])),
  ];

  // A dropdown with no options is invalid, so fall back to free text if the
  // database has nothing to offer yet.
  fields.push(
    options.countries.length > 0
      ? { label: "Nationality", kind: "dropdown", required: false, options: options.countries }
      : { label: "Nationality", kind: "input", type: "INPUT_TEXT", required: false },
  );

  fields.push({ label: "National ID or passport number", kind: "input", type: "INPUT_TEXT", required: true });

  fields.push(
    options.clubs.length > 0
      ? { label: "Club name", kind: "dropdown", required: true, options: options.clubs }
      : { label: "Club name", kind: "input", type: "INPUT_TEXT", required: true },
  );

  return fields;
}

// Tally's block model is flat: every block carries its own uuid plus a groupUuid
// naming the question it belongs to. Rules learned from its validator:
//   1. A TITLE (label) block must sit in its OWN group — it cannot share a
//      groupUuid with the input it labels.
//   2. A dropdown is expressed purely as DROPDOWN_OPTION blocks sharing one
//      groupUuid; there is no separate parent input block.
//   3. Each option needs a zero-based `index`, plus `isFirst` / `isLast` flags
//      marking the ends of the list.
function buildBlocks(formTitle: string, options: FormOptions) {
  const blocks: Record<string, unknown>[] = [];
  const titleUuid = randomUUID();
  blocks.push({ uuid: titleUuid, type: "FORM_TITLE", groupUuid: titleUuid, groupType: "FORM_TITLE", payload: { html: formTitle } });

  for (const field of buildFields(options)) {
    const labelGroupUuid = randomUUID();
    blocks.push({ uuid: randomUUID(), type: "TITLE", groupUuid: labelGroupUuid, groupType: "TITLE", payload: { html: field.label } });

    const inputGroupUuid = randomUUID();
    if (field.kind === "dropdown") {
      field.options.forEach((opt, index) => {
        blocks.push({
          uuid: randomUUID(),
          type: "DROPDOWN_OPTION",
          groupUuid: inputGroupUuid,
          groupType: "DROPDOWN",
          payload: { index, isFirst: index === 0, isLast: index === field.options.length - 1, text: opt, isRequired: field.required },
        });
      });
    } else {
      blocks.push({ uuid: randomUUID(), type: field.type, groupUuid: inputGroupUuid, groupType: field.type, payload: { isRequired: field.required } });
    }
  }
  return blocks;
}

export async function createGradingTallyForm(eventId: string, title: string, options: FormOptions): Promise<{ formId: string; formUrl: string; editUrl: string; signingSecret: string }> {
  const created = await tallyFetch("/forms", { method: "POST", body: JSON.stringify({ status: "PUBLISHED", blocks: buildBlocks(title, options) }) });
  const formId = created.id as string;
  if (!formId) throw new Error("Tally did not return a form ID.");
  const signingSecret = randomUUID().replace(/-/g, "");
  const webhookUrl = `${getBaseUrl()}/api/grading-webhook?eventId=${eventId}`;
  await tallyFetch("/webhooks", { method: "POST", body: JSON.stringify({ formId, url: webhookUrl, signingSecret, eventTypes: ["FORM_RESPONSE"] }) });
  return { formId, formUrl: `https://tally.so/r/${formId}`, editUrl: `https://tally.so/forms/${formId}/edit`, signingSecret };
}

/**
 * Rebuild an existing form's questions from the current database contents, so a
 * newly added club shows up in a form that already exists. Answers already
 * submitted are unaffected — they're matched back by question label, and the
 * labels don't change.
 */
export async function updateGradingTallyFormOptions(formId: string, title: string, options: FormOptions): Promise<void> {
  await tallyFetch(`/forms/${formId}`, { method: "PATCH", body: JSON.stringify({ status: "PUBLISHED", blocks: buildBlocks(title, options) }) });
}

export function verifyTallySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  try { return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); } catch { return false; }
}

export type TallySubmissionField = { key: string; label: string; type: string; value: unknown; options?: { id: string; text: string }[] };
export type ParsedGradingRow = { firstName: string; lastName: string; email: string | null; birthday: string | null; gender: string | null; weightKg: number | null; heightCm: number | null; gup: number | null; dan: number | null; nationality: string | null; nationalId: string | null; clubName: string | null };

/**
 * Reads one answer as text, whether it arrives as a plain string (text input)
 * or as an array of selected option IDs (dropdown).
 */
function resolveText(field: TallySubmissionField | undefined): string | null {
  if (!field) return null;
  const raw = field.value;
  if (typeof raw === "string") return raw.trim() || null;
  if (typeof raw === "number") return String(raw);
  if (Array.isArray(raw) && raw.length > 0) {
    const id = String(raw[0]);
    const opt = (field.options ?? []).find((o) => o.id === id);
    return ((opt ? opt.text : id) || "").trim() || null;
  }
  return null;
}

export function parseTallyFields(fields: TallySubmissionField[]): ParsedGradingRow {
  // Matched on label prefix so labels can carry hints — "Gender (male, female
  // or other)" still resolves from "gender". Note "nationality" and
  // "national id" are deliberately distinct prefixes.
  const find = (prefix: string) => fields.find((f) => f.label.trim().toLowerCase().startsWith(prefix));
  const text = (prefix: string) => resolveText(find(prefix));
  const num = (prefix: string) => {
    const v = text(prefix);
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  let gender = text("gender")?.toLowerCase() ?? null;
  if (gender && !["male", "female", "other"].includes(gender)) gender = null;

  return {
    firstName: (text("first name") ?? "").toUpperCase(),
    lastName: (text("last name") ?? "").toUpperCase(),
    email: text("email"),
    birthday: text("date of birth"),
    gender,
    weightKg: num("weight"),
    heightCm: num("height"),
    ...parseGradeText(text("current grade") ?? text("current belt")),
    nationality: text("nationality"),
    nationalId: text("national id"),
    clubName: text("club"),
  };
}

export async function listTallySubmissions(formId: string): Promise<ParsedGradingRow[]> {
  const rows: ParsedGradingRow[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const data = await tallyFetch(`/forms/${formId}/submissions?page=${page}&limit=100`, { method: "GET" });
    const questionById = new Map<string, { title: string; options?: { id: string; text: string }[] }>(
      (data.questions ?? []).map((q: any) => [q.id, { title: q.title, options: q.options }]),
    );
    for (const submission of data.submissions ?? []) {
      const fields: TallySubmissionField[] = (submission.responses ?? []).map((r: any) => {
        const q = questionById.get(r.questionId);
        return { key: r.questionId, label: q?.title ?? "", type: "", value: r.answer, options: q?.options };
      });
      rows.push(parseTallyFields(fields));
    }
    hasMore = Boolean(data.hasMore);
    page += 1;
  }
  return rows;
}
