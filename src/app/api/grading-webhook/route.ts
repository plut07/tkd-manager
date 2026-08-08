import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTallySignature, parseTallyFields, type TallySubmissionField } from "@/lib/tallyForms";
function normalize(s: string | null | undefined) { return (s ?? "").trim().toLowerCase(); }
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("tally-signature");
  const eventId = request.nextUrl.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  const supabase = supabaseAdmin();
  const { data: gform } = await supabase.from("grading_forms").select("*").eq("event_id", eventId).maybeSingle();
  if (!gform) return NextResponse.json({ error: "Unknown form" }, { status: 404 });
  if (!verifyTallySignature(raw, signature, gform.signing_secret)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const fields: TallySubmissionField[] = payload?.data?.fields ?? [];
  const row = parseTallyFields(fields);
  if (!row.nationalId || !row.firstName || !row.lastName) return NextResponse.json({ ok: true, skipped: true });
  const { data: existingStudent } = await supabase.from("students").select("id, club_id").or(`national_id.eq.${row.nationalId},passport_id.eq.${row.nationalId}`).maybeSingle();
  if (existingStudent) {
    const { data: alreadyReg } = await supabase.from("event_registrations").select("id").eq("event_id", eventId).eq("student_id", existingStudent.id).maybeSingle();
    if (!alreadyReg) await supabase.from("event_registrations").insert({ event_id: eventId, student_id: existingStudent.id, club_id: existingStudent.club_id, status: "pending" });
    await supabase.from("grading_import_batches").insert({ event_id: eventId, row_count: 1, matched_count: 1, new_count: 0 });
    return NextResponse.json({ ok: true, matched: true });
  }
  const { data: existingCandidate } = await supabase.from("grading_candidates").select("id").eq("event_id", eventId).eq("national_id", row.nationalId).maybeSingle();
  if (existingCandidate) return NextResponse.json({ ok: true, duplicate: true });
  const { data: clubs } = await supabase.from("clubs").select("id, name").eq("active", true);
  const matchedClub = (clubs ?? []).find((c) => normalize(c.name) === normalize(row.clubName));
  const { data: batch } = await supabase.from("grading_import_batches").insert({ event_id: eventId, row_count: 1, matched_count: 0, new_count: 1 }).select("id").single();
  if (batch) {
    await supabase.from("grading_candidates").insert({ batch_id: batch.id, event_id: eventId, first_name: row.firstName, last_name: row.lastName, email: row.email, birthday: row.birthday, gender: row.gender, weight_kg: row.weightKg, height_cm: row.heightCm, gup: row.gup, dan: row.dan, nationality: row.nationality, national_id: row.nationalId, club_name_raw: row.clubName, matched_club_id: matchedClub?.id ?? null });
  }
  return NextResponse.json({ ok: true, staged: true });
}
