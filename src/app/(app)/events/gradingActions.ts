"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, requireSuperAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { createGradingTallyForm, updateGradingTallyFormOptions, listTallySubmissions, type FormOptions, type ParsedGradingRow } from "@/lib/tallyForms";
import { COUNTRIES } from "@/lib/countries";
import { gradingCategoryIdFor } from "@/lib/gradingCategory";

/** Next free running number within a club, so approved candidates get one too. */
async function nextClubNumber(supabase: ReturnType<typeof supabaseAdmin>, clubId: string): Promise<number> {
  const { data } = await supabase.from("students").select("club_number").eq("club_id", clubId)
    .order("club_number", { ascending: false }).limit(1).maybeSingle();
  return (Number(data?.club_number) || 0) + 1;
}
function normalize(s: string | null | undefined) { return (s ?? "").trim().toLowerCase(); }
/** The dropdown contents for a grading form, read fresh from the database. */
async function currentFormOptions(supabase: ReturnType<typeof supabaseAdmin>): Promise<FormOptions> {
  const { data: clubs } = await supabase.from("clubs").select("name").eq("active", true).order("name");
  return { clubs: (clubs ?? []).map((c) => c.name).filter(Boolean), countries: [...COUNTRIES] };
}
export async function createGradingForm(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.EVENT_EDIT);
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) return;
  const supabase = supabaseAdmin();
  const { data: existing } = await supabase.from("grading_forms").select("id").eq("event_id", eventId).maybeSingle();
  if (existing) throw new Error("A registration form has already been created for this event.");
  const { data: event } = await supabase.from("events").select("name").eq("id", eventId).maybeSingle();
  if (!event) throw new Error("Event not found.");
  const created = await createGradingTallyForm(eventId, `${event.name} — Grading Registration`, await currentFormOptions(supabase));
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
    if (!idValue || !row.fullName) continue;
    const { data: existingStudent } = await supabase.from("students").select("id, club_id, gup, dan").eq("national_id", idValue).maybeSingle();
    if (existingStudent) {
      // Refresh the details the form just supplied. Only non-empty answers are
      // written, so a blank box never wipes something we already knew.
      const refresh: Record<string, unknown> = {};
      if (row.birthday) refresh.birthday = row.birthday;
      if (row.gender) refresh.gender = row.gender;
      if (row.weightKg != null) refresh.weight_kg = row.weightKg;
      if (row.heightCm != null) refresh.height_cm = row.heightCm;
      if (row.gup != null || row.dan != null) { refresh.gup = row.gup; refresh.dan = row.dan; }
      if (row.nationality) refresh.nationality = row.nationality;
      if (row.email) refresh.email = row.email;
      if (row.fullName) refresh.full_name = row.fullName.toUpperCase();
      if (Object.keys(refresh).length > 0) await supabase.from("students").update(refresh).eq("id", existingStudent.id);

      const { data: alreadyReg } = await supabase.from("event_registrations").select("id").eq("event_id", eventId).eq("student_id", existingStudent.id).maybeSingle();
      if (!alreadyReg) {
        // The grade on the form wins if they gave one, since it's the most
        // recent thing we know about them.
        const gup = row.gup != null || row.dan != null ? row.gup : existingStudent.gup;
        const dan = row.gup != null || row.dan != null ? row.dan : existingStudent.dan;
        // This also runs from the Tally webhook, where throwing would lose the
        // whole submission. The entry is worth more than the category, which
        // approval works out again anyway.
        let categoryId: string | null = null;
        try {
          categoryId = await gradingCategoryIdFor(supabase, eventId, gup ?? null, dan ?? null);
        } catch {
          categoryId = null;
        }
        await supabase.from("event_registrations").insert({ event_id: eventId, student_id: existingStudent.id, club_id: existingStudent.club_id, category_id: categoryId, status: "pending" });
      }
      matchedCount++;
      continue;
    }
    if (alreadyStaged.has(normalize(idValue))) continue;
    newCandidateRows.push({ event_id: eventId, full_name: row.fullName, email: row.email || null, birthday: row.birthday || null, gender: row.gender || null, weight_kg: row.weightKg, height_cm: row.heightCm, gup: row.gup, dan: row.dan, nationality: row.nationality || null, national_id: idValue, club_name_raw: row.clubName || null, matched_club_id: clubByName.get(normalize(row.clubName)) ?? null });
    newCount++;
  }
  const { data: batch, error: batchError } = await supabase.from("grading_import_batches").insert({ event_id: eventId, imported_by: importedBy, row_count: rows.length, matched_count: matchedCount, new_count: newCount }).select("id").single();
  if (batchError || !batch) throw new Error("Could not record the import batch.");
  if (newCandidateRows.length > 0) await supabase.from("grading_candidates").insert(newCandidateRows.map((c) => ({ ...c, batch_id: batch.id })));
  return { matchedCount, newCount };
}
/**
 * Push the current club list into an existing form. Needed because a form's
 * dropdown options are fixed when the form is built, so a club added later
 * wouldn't otherwise appear as a choice.
 */
export async function refreshGradingFormOptions(formData: FormData) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) return;
  const supabase = supabaseAdmin();
  const { data: gform } = await supabase.from("grading_forms").select("tally_form_id").eq("event_id", eventId).maybeSingle();
  if (!gform) throw new Error("No registration form has been created for this event yet.");
  const { data: event } = await supabase.from("events").select("name").eq("id", eventId).maybeSingle();
  if (!event) throw new Error("Event not found.");
  await updateGradingTallyFormOptions(gform.tally_form_id, `${event.name} — Grading Registration`, await currentFormOptions(supabase));
  revalidatePath(`/events/${eventId}`);
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
  const { data: student, error: studentError } = await supabase.from("students").insert({ club_id: clubId, club_number: await nextClubNumber(supabase, clubId), full_name: candidate.full_name, email: candidate.email, birthday: candidate.birthday, gender: candidate.gender, weight_kg: candidate.weight_kg, height_cm: candidate.height_cm, gup: candidate.gup, dan: candidate.dan, nationality: candidate.nationality, national_id: candidate.national_id, active: true }).select("id").single();
  if (studentError || !student) throw new Error("Could not create the student record.");
  const categoryId = await gradingCategoryIdFor(supabase, candidate.event_id, candidate.gup, candidate.dan);
  await supabase.from("event_registrations").insert({ event_id: candidate.event_id, student_id: student.id, club_id: clubId, category_id: categoryId, status: "pending" });
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
    const { data: student } = await supabase.from("students").insert({ club_id: candidate.matched_club_id, club_number: await nextClubNumber(supabase, candidate.matched_club_id), full_name: candidate.full_name, email: candidate.email, birthday: candidate.birthday, gender: candidate.gender, weight_kg: candidate.weight_kg, height_cm: candidate.height_cm, gup: candidate.gup, dan: candidate.dan, nationality: candidate.nationality, national_id: candidate.national_id, active: true }).select("id").single();
    if (!student) continue;
    const categoryId = await gradingCategoryIdFor(supabase, candidate.event_id, candidate.gup, candidate.dan);
    await supabase.from("event_registrations").insert({ event_id: candidate.event_id, student_id: student.id, club_id: candidate.matched_club_id, category_id: categoryId, status: "pending" });
    await supabase.from("grading_candidates").update({ status: "approved", reviewed_by: session.sub, reviewed_at: new Date().toISOString(), created_student_id: student.id }).eq("id", candidate.id);
  }
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/register`);
}
