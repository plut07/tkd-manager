"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { buildBracket, type BracketCompetitor } from "@/lib/bracket";

export async function generateBracket(formData: FormData) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const eventId = String(formData.get("eventId") || "");
  const categoryId = String(formData.get("categoryId") || "");
  if (!eventId || !categoryId) return;

  const supabase = supabaseAdmin();

  const { data: existingBracket } = await supabase
    .from("event_category_brackets")
    .select("status")
    .eq("event_category_id", categoryId)
    .maybeSingle();
  if (existingBracket?.status === "published") {
    throw new Error("This bracket is already published. Unpublish it first if you need to regenerate the draw.");
  }

  const { data: regs } = await supabase
    .from("event_registrations")
    .select("id, student_id, club_id, students(nationality), clubs(name)")
    .eq("event_id", eventId)
    .eq("category_id", categoryId)
    .eq("status", "confirmed");

  const competitors: BracketCompetitor[] = (regs ?? []).map((r: any) => ({
    registrationId: r.id,
    studentId: r.student_id,
    clubId: r.club_id,
    clubName: r.clubs?.name ?? null,
    nationality: r.students?.nationality ?? null,
  }));

  if (competitors.length < 2) {
    throw new Error("Need at least 2 confirmed competitors in this category to generate a bracket.");
  }

  const { matches } = buildBracket(eventId, categoryId, competitors);

  await supabase.from("event_matches").delete().eq("category_id", categoryId);
  const { error } = await supabase.from("event_matches").insert(matches);
  if (error) throw new Error("Could not generate bracket.");

  await supabase.from("event_category_brackets").upsert(
    { event_category_id: categoryId, status: "draft", generated_at: new Date().toISOString() },
    { onConflict: "event_category_id" }
  );

  revalidatePath(`/events/${eventId}/categories/${categoryId}/bracket`);
}

export async function submitMatchResult(formData: FormData) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const matchId = String(formData.get("matchId") || "");
  const eventId = String(formData.get("eventId") || "");
  const categoryId = String(formData.get("categoryId") || "");
  const p1 = Number(formData.get("points1"));
  const p2 = Number(formData.get("points2"));
  if (!matchId) return;
  if (!Number.isInteger(p1) || !Number.isInteger(p2) || p1 < 0 || p1 > 5 || p2 < 0 || p2 > 5) {
    throw new Error("Points must be whole numbers between 0 and 5.");
  }
  if (p1 === p2) throw new Error("Points can't be tied — enter a clear winner.");

  const supabase = supabaseAdmin();
  const { data: match } = await supabase.from("event_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) throw new Error("Match not found.");
  if (!match.competitor1_registration_id || !match.competitor2_registration_id) {
    throw new Error("Both competitors must be set before entering a result.");
  }

  const winnerId = p1 > p2 ? match.competitor1_registration_id : match.competitor2_registration_id;
  const loserId = p1 > p2 ? match.competitor2_registration_id : match.competitor1_registration_id;

  await supabase
    .from("event_matches")
    .update({ competitor1_points: p1, competitor2_points: p2, winner_registration_id: winnerId })
    .eq("id", matchId);

  if (match.next_match_id) {
    const field = match.next_slot === 1 ? "competitor1_registration_id" : "competitor2_registration_id";
    await supabase.from("event_matches").update({ [field]: winnerId }).eq("id", match.next_match_id);
  }
  if (match.loser_next_match_id) {
    const field = match.loser_next_slot === 1 ? "competitor1_registration_id" : "competitor2_registration_id";
    await supabase.from("event_matches").update({ [field]: loserId }).eq("id", match.loser_next_match_id);
  }

  revalidatePath(`/events/${eventId}/categories/${categoryId}/bracket`);
  revalidatePath(`/public/events/${eventId}/categories/${categoryId}/bracket`);
}

export async function swapBracketSlots(formData: FormData) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const eventId = String(formData.get("eventId") || "");
  const categoryId = String(formData.get("categoryId") || "");
  const a = String(formData.get("a") || "");
  const b = String(formData.get("b") || "");
  const [matchAId, slotAStr] = a.split(":");
  const [matchBId, slotBStr] = b.split(":");
  if (!matchAId || !matchBId || !slotAStr || !slotBStr) return;
  const slotA = Number(slotAStr);
  const slotB = Number(slotBStr);

  const supabase = supabaseAdmin();
  const { data: bracket } = await supabase
    .from("event_category_brackets")
    .select("status")
    .eq("event_category_id", categoryId)
    .maybeSingle();
  if (bracket?.status === "published") throw new Error("Unpublish the bracket before editing the draw.");

  const fieldA = slotA === 1 ? "competitor1_registration_id" : "competitor2_registration_id";
  const fieldB = slotB === 1 ? "competitor1_registration_id" : "competitor2_registration_id";

  const { data: matchA } = await supabase.from("event_matches").select("*").eq("id", matchAId).maybeSingle();
  const { data: matchB } = await supabase.from("event_matches").select("*").eq("id", matchBId).maybeSingle();
  if (!matchA || !matchB) return;

  await supabase.from("event_matches").update({ [fieldA]: (matchB as any)[fieldB] ?? null }).eq("id", matchAId);
  await supabase.from("event_matches").update({ [fieldB]: (matchA as any)[fieldA] ?? null }).eq("id", matchBId);

  revalidatePath(`/events/${eventId}/categories/${categoryId}/bracket`);
}

export async function publishBracket(formData: FormData) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const eventId = String(formData.get("eventId") || "");
  const categoryId = String(formData.get("categoryId") || "");
  if (!categoryId) return;
  await supabaseAdmin()
    .from("event_category_brackets")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("event_category_id", categoryId);
  revalidatePath(`/events/${eventId}/categories/${categoryId}/bracket`);
  revalidatePath(`/public/events/${eventId}`);
  revalidatePath(`/public/events/${eventId}/categories/${categoryId}/bracket`);
}

export async function unpublishBracket(formData: FormData) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const eventId = String(formData.get("eventId") || "");
  const categoryId = String(formData.get("categoryId") || "");
  if (!categoryId) return;
  await supabaseAdmin()
    .from("event_category_brackets")
    .update({ status: "draft", published_at: null })
    .eq("event_category_id", categoryId);
  revalidatePath(`/events/${eventId}/categories/${categoryId}/bracket`);
  revalidatePath(`/public/events/${eventId}`);
  revalidatePath(`/public/events/${eventId}/categories/${categoryId}/bracket`);
}
