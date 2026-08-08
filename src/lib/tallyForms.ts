import "server-only";
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
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
type FieldSpec = { label: string; type: "INPUT_TEXT" | "INPUT_EMAIL" | "INPUT_DATE" | "INPUT_NUMBER" | "MULTIPLE_CHOICE"; required: boolean; options?: string[] };
const FIELDS: FieldSpec[] = [
  { label: "First name", type: "INPUT_TEXT", required: true },
  { label: "Last name", type: "INPUT_TEXT", required: true },
  { label: "Email", type: "INPUT_EMAIL", required: false },
  { label: "Date of birth", type: "INPUT_DATE", required: false },
  { label: "Gender", type: "MULTIPLE_CHOICE", required: false, options: ["male", "female", "other"] },
  { label: "Weight (kg)", type: "INPUT_NUMBER", required: false },
  { label: "Height (cm)", type: "INPUT_NUMBER", required: false },
  { label: "Current Gup (1-10, leave blank if black belt)", type: "INPUT_NUMBER", required: false },
  { label: "Current Dan (1-9, leave blank if not black belt)", type: "INPUT_NUMBER", required: false },
  { label: "Nationality", type: "INPUT_TEXT", required: false },
  { label: "National ID or passport number", type: "INPUT_TEXT", required: true },
  { label: "Club name", type: "INPUT_TEXT", required: true },
];
// Tally's block model is flat: each block carries its own uuid plus a groupUuid
// saying which question it belongs to. Two rules matter here:
//   1. A TITLE (label) block must sit in its OWN group — it cannot share a
//      groupUuid with the input it labels, or the API rejects the form.
//   2. A multiple-choice question is expressed purely as MULTIPLE_CHOICE_OPTION
//      blocks sharing one groupUuid; there is no separate parent input block.
function buildBlocks(formTitle: string) {
  const blocks: Record<string, unknown>[] = [];
  const titleUuid = randomUUID();
  blocks.push({ uuid: titleUuid, type: "FORM_TITLE", groupUuid: titleUuid, groupType: "FORM_TITLE", payload: { html: formTitle } });
  for (const field of FIELDS) {
    const labelGroupUuid = randomUUID();
    blocks.push({ uuid: randomUUID(), type: "TITLE", groupUuid: labelGroupUuid, groupType: "TITLE", payload: { html: field.label } });
    const inputGroupUuid = randomUUID();
    if (field.type === "MULTIPLE_CHOICE") {
      (field.options ?? []).forEach((opt) => {
        blocks.push({ uuid: randomUUID(), type: "MULTIPLE_CHOICE_OPTION", groupUuid: inputGroupUuid, groupType: "MULTIPLE_CHOICE", payload: { text: opt, isRequired: field.required } });
      });
    } else {
      blocks.push({ uuid: randomUUID(), type: field.type, groupUuid: inputGroupUuid, groupType: field.type, payload: { isRequired: field.required } });
    }
  }
  return blocks;
}
export async function createGradingTallyForm(eventId: string, title: string): Promise<{ formId: string; formUrl: string; editUrl: string; signingSecret: string }> {
  const created = await tallyFetch("/forms", { method: "POST", body: JSON.stringify({ status: "PUBLISHED", blocks: buildBlocks(title) }) });
  const formId = created.id as string;
  if (!formId) throw new Error("Tally did not return a form ID.");
  const signingSecret = randomUUID().replace(/-/g, "");
  const webhookUrl = `${getBaseUrl()}/api/grading-webhook?eventId=${eventId}`;
  await tallyFetch("/webhooks", { method: "POST", body: JSON.stringify({ formId, url: webhookUrl, signingSecret, eventTypes: ["FORM_RESPONSE"] }) });
  return { formId, formUrl: `https://tally.so/r/${formId}`, editUrl: `https://tally.so/forms/${formId}/edit`, signingSecret };
}
export function verifyTallySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  try { return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); } catch { return false; }
}
export type TallySubmissionField = { key: string; label: string; type: string; value: unknown; options?: { id: string; text: string }[] };
export type ParsedGradingRow = { firstName: string; lastName: string; email: string | null; birthday: string | null; gender: string | null; weightKg: number | null; heightCm: number | null; gup: number | null; dan: number | null; nationality: string | null; nationalId: string | null; clubName: string | null };
export function parseTallyFields(fields: TallySubmissionField[]): ParsedGradingRow {
  const byLabel = new Map(fields.map((f) => [f.label.trim().toLowerCase(), f]));
  const str = (label: string) => { const v = byLabel.get(label.toLowerCase())?.value; return typeof v === "string" && v.trim() ? v.trim() : null; };
  const num = (label: string) => { const v = byLabel.get(label.toLowerCase())?.value; if (v == null || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
  // Tally reports a choice answer as an array of selected option IDs, but a
  // backfilled submission can arrive as the plain option text. Accept either.
  const genderField = byLabel.get("gender");
  let gender: string | null = null;
  if (genderField) {
    const raw = genderField.value;
    if (Array.isArray(raw) && raw.length > 0) {
      const selectedId = String(raw[0]);
      const opt = (genderField.options ?? []).find((o) => o.id === selectedId);
      gender = (opt ? opt.text : selectedId).toLowerCase();
    } else if (typeof raw === "string" && raw.trim()) {
      gender = raw.trim().toLowerCase();
    }
    if (gender && !["male", "female", "other"].includes(gender)) gender = null;
  }
  return {
    firstName: str("First name") ?? "", lastName: str("Last name") ?? "", email: str("Email"),
    birthday: str("Date of birth"), gender,
    weightKg: num("Weight (kg)"), heightCm: num("Height (cm)"),
    gup: num("Current Gup (1-10, leave blank if black belt)"), dan: num("Current Dan (1-9, leave blank if not black belt)"),
    nationality: str("Nationality"), nationalId: str("National ID or passport number"), clubName: str("Club name"),
  };
}
export async function listTallySubmissions(formId: string): Promise<ParsedGradingRow[]> {
  const rows: ParsedGradingRow[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const data = await tallyFetch(`/forms/${formId}/submissions?page=${page}&limit=100`, { method: "GET" });
    const questionById = new Map((data.questions ?? []).map((q: any) => [q.id, q.title]));
    for (const submission of data.submissions ?? []) {
      const fields: TallySubmissionField[] = (submission.responses ?? []).map((r: any) => ({ key: r.questionId, label: questionById.get(r.questionId) ?? "", type: "", value: r.answer }));
      rows.push(parseTallyFields(fields));
    }
    hasMore = Boolean(data.hasMore);
    page += 1;
  }
  return rows;
}