"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, requireSuperAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { createGradingTallyForm, listTallySubmissions, type ParsedGradingRow } from "@/lib/tallyForms";
function normalize(s: string | null | undefined) { return (s ?? "").trim().toLowerCase(); }
export async function createGradingForm(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.EVENT_EDIT);
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) return;
  const supabase = supabaseAdmin();
  const { data: existing } = await supabase.from("grading_forms").select("id").eq("event_id", eventId).maybeSingle();
  if (existing) throw new Error("A registration form has already been created for this event.");
  const { data: event } = await supabase.from("events").select("name").eq("id", eventId).maybeSingle();
  if (!event) throw new Error("Event not found.");
  const created = await createGradingTallyForm(eventId, `${event.name} — Grading Registration`);
  const { error } = await supabase.from("grading_forms").insert({ event_id: eventId, tally_form_id: created.formId, form_url: created.formUrl, edit_url: created.editUrl, signing_secret: created.signingSecret, created_by: session.sub });
  if (error) throw new Error("The Tally form was created, but saving it to the event failed. Please try again.");
  revalidatePath(`/events/${eventId}`);
}
async function stageRows(supabase: ReturnType<typeof supabaseAdmin>, eventId: string, rows: ParsedGradingRow[], importedBy: string | null) {
  const { data: existingCandidates } = await supabase.from("grading_candidates").select("national_id").eq("event_id", eventId);
  const alreadyStaged = new Set((existingCandidates ?? []).map((r) => normalize(r.national_id)));
  const { data: clubs } = await supabase.from("clubs").select("id, name").eq("active", true);
  const clubByName = new Map((clubs ?? []).map((c) => [normalize(c.name), c.id]));
  let matchedCount = 0;
  let newCount = 0;
  const newCandidateRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    const idValue = (row.nationalId ?? "").trim();
    if (!idValue || !row.firstName || !row.lastName) continue;
    const { data: existingStudent } = await supabase.from("students").select("id, club_id").or(`national_id.eq.${idValue},passport_id.eq.${idValue}`).maybeSingle();
    if (existingStudent) {
      const { data: alreadyReg } = await supabase.from("event_registrations").select("id").eq("event_id", eventId).eq("student_id", existingStudent.id).maybeSingle();
      if (!alreadyReg) await supabase.from("event_registrations").insert({ event_id: eventId, student_id: existingStudent.id, club_id: existingStudent.club_id, status: "pending" });
      matchedCount++;
      continue;
    }
    if (alreadyStaged.has(normalize(idValue))) continue;
    newCandidateRows.push({ event_id: eventId, first_name: row.firstName, last_name: row.lastName, email: row.email || null, birthday: row.birthday || null, gender: row.gender || null, weight_kg: row.weightKg, height_cm: row.heightCm, gup: row.gup, dan: row.dan, nationality: row.nationality || null, national_id: idValue, club_name_raw: row.clubName || null, matched_club_id: clubByName.get(normalize(row.clubName)) ?? null });
    newCount++;
  }
  const { data: batch, error: batchError } = await supabase.from("grading_import_batches").insert({ event_id: eventId, imported_by: importedBy, row_count: rows.length, matched_count: matchedCount, new_count: newCount }).select("id").single();
  if (batchError || !batch) throw new Error("Could not record the import batch.");
  if (newCandidateRows.length > 0) await supabase.from("grading_candidates").insert(newCandidateRows.map((c) => ({ ...c, batch_id: batch.id })));
  return { matchedCount, newCount };
}
export async function syncGradingResponses(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.EVENT_EDIT);
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) return;
  const supabase = supabaseAdmin();
  const { data: gform } = await supabase.from("grading_forms").select("*").eq("event_id", eventId).maybeSingle();
  if (!gform) throw new Error("No registration form has been created for this event yet.");
  const rows = await listTallySubmissions(gform.tally_form_id);
  await stageRows(supabase, eventId, rows, session.sub);
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/register`);
}
export async function approveCandidate(formData: FormData) {
  const session = await requireSuperAdmin();
  const candidateId = String(formData.get("candidateId") || "");
  const clubId = String(formData.get("clubId") || "");
  const eventId = String(formData.get("eventId") || "");
  if (!candidateId || !clubId) throw new Error("Choose a club before approving.");
  const supabase = supabaseAdmin();
  const { data: candidate } = await supabase.from("grading_candidates").select("*").eq("id", candidateId).maybeSingle();
  if (!candidate || candidate.status !== "pending") throw new Error("This candidate is no longer pending.");
  const { data: student, error: studentError } = await supabase.from("students").insert({ club_id: clubId, first_name: candidate.first_name, last_name: candidate.last_name, email: candidate.email, birthday: candidate.birthday, gender: candidate.gender, weight_kg: candidate.weight_kg, height_cm: candidate.height_cm, gup: candidate.gup, dan: candidate.dan, nationality: candidate.nationality, national_id: candidate.national_id, passport_id: candidate.passport_id, active: true }).select("id").single();
  if (studentError || !student) throw new Error("Could not create the student record.");
  await supabase.from("event_registrations").insert({ event_id: candidate.event_id, student_id: student.id, club_id: clubId, status: "pending" });
  await supabase.from("grading_candidates").update({ status: "approved", reviewed_by: session.sub, reviewed_at: new Date().toISOString(), created_student_id: student.id }).eq("id", candidateId);
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/register`);
}
export async function rejectCandidate(formData: FormData) {
  const session = await requireSuperAdmin();
  const candidateId = String(formData.get("candidateId") || "");
  const eventId = String(formData.get("eventId") || "");
  if (!candidateId) return;
  const supabase = supabaseAdmin();
  await supabase.from("grading_candidates").update({ status: "rejected", reviewed_by: session.sub, reviewed_at: new Date().toISOString() }).eq("id", candidateId).eq("status", "pending");
  revalidatePath(`/events/${eventId}`);
}
export async function bulkApproveBatch(formData: FormData) {
  const session = await requireSuperAdmin();
  const batchId = String(formData.get("batchId") || "");
  const eventId = String(formData.get("eventId") || "");
  if (!batchId) return;
  const supabase = supabaseAdmin();
  const { data: candidates } = await supabase.from("grading_candidates").select("*").eq("batch_id", batchId).eq("status", "pending").not("matched_club_id", "is", null);
  for (const candidate of candidates ?? []) {
    const { data: student } = await supabase.from("students").insert({ club_id: candidate.matched_club_id, first_name: candidate.first_name, last_name: candidate.last_name, email: candidate.email, birthday: candidate.birthday, gender: candidate.gender, weight_kg: candidate.weight_kg, height_cm: candidate.height_cm, gup: candidate.gup, dan: candidate.dan, nationality: candidate.nationality, national_id: candidate.national_id, passport_id: candidate.passport_id, active: true }).select("id").single();
    if (!student) continue;
    await supabase.from("event_registrations").insert({ event_id: candidate.event_id, student_id: student.id, club_id: candidate.matched_club_id, status: "pending" });
    await supabase.from("grading_candidates").update({ status: "approved", reviewed_by: session.sub, reviewed_at: new Date().toISOString(), created_student_id: student.id }).eq("id", candidate.id);
  }
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/register`);
}
