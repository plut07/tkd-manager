"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fail } from "@/lib/flash";
import { PERMISSIONS } from "@/lib/permissions";
import { buildBracket, type BracketCompetitor } from "@/lib/bracket";
import { competitorName } from "@/lib/competitors";

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
    fail("This bracket is already published. Unpublish it first if you need to regenerate the draw.");
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
    fail("Need at least 2 confirmed competitors in this category to generate a bracket.");
  }

  const { matches } = buildBracket(eventId, categoryId, competitors);

  await supabase.from("event_matches").delete().eq("category_id", categoryId);
  const { error } = await supabase.from("event_matches").insert(matches);
  if (error) fail("Could not generate bracket.");

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
    fail("Points must be whole numbers between 0 and 5.");
  }
  if (p1 === p2) fail("Points can't be tied — enter a clear winner.");

  const supabase = supabaseAdmin();
  const { data: match } = await supabase.from("event_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) fail("Match not found.");
  if (!match.competitor1_registration_id || !match.competitor2_registration_id) {
    fail("Both competitors must be set before entering a result.");
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
  if (bracket?.status === "published") fail("Unpublish the bracket before editing the draw.");

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

/**
 * Take a result back off a match.
 *
 * A mis-keyed score isn't just a wrong number in one box: the winner has
 * already been carried into the next round, so clearing has to pull them out
 * again — otherwise the draw keeps a competitor who never won anything. Only
 * the slot this match fed is cleared, and only if it still holds this winner,
 * so a later correction can't wipe somebody else's place.
 */
export async function clearMatchResult(formData: FormData) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const matchId = String(formData.get("matchId") || "");
  const eventId = String(formData.get("eventId") || "");
  const categoryId = String(formData.get("categoryId") || "");
  if (!matchId) return;

  const supabase = supabaseAdmin();
  const { data: match } = await supabase.from("event_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) fail("Match not found.");
  if (!match.winner_registration_id) return;

  const { data: bracket } = await supabase
    .from("event_category_brackets")
    .select("status")
    .eq("event_category_id", match.category_id)
    .maybeSingle();
  if (bracket?.status === "published") {
    fail("This draw is published. Unpublish it before changing a result.");
  }

  const winnerId = match.winner_registration_id;
  const loserId =
    match.competitor1_registration_id === winnerId ? match.competitor2_registration_id : match.competitor1_registration_id;

  if (match.next_match_id) {
    const field = match.next_slot === 1 ? "competitor1_registration_id" : "competitor2_registration_id";
    const { data: next } = await supabase.from("event_matches").select("*").eq("id", match.next_match_id).maybeSingle();
    if (next && next[field] === winnerId) {
      if (next.winner_registration_id) {
        fail("The next round has already been scored. Clear that result first.");
      }
      await supabase.from("event_matches").update({ [field]: null }).eq("id", match.next_match_id);
    }
  }
  if (match.loser_next_match_id && loserId) {
    const field = match.loser_next_slot === 1 ? "competitor1_registration_id" : "competitor2_registration_id";
    const { data: next } = await supabase.from("event_matches").select("*").eq("id", match.loser_next_match_id).maybeSingle();
    if (next && next[field] === loserId && !next.winner_registration_id) {
      await supabase.from("event_matches").update({ [field]: null }).eq("id", match.loser_next_match_id);
    }
  }

  const { error } = await supabase
    .from("event_matches")
    .update({ competitor1_points: null, competitor2_points: null, winner_registration_id: null })
    .eq("id", matchId);
  if (error) fail(`The result could not be cleared: ${error.message}`);

  revalidatePath(`/events/${eventId}?tab=draws`);
  revalidatePath(`/events/${eventId}/categories/${categoryId}/bracket`);
  revalidatePath(`/public/events/${eventId}/categories/${categoryId}/bracket`);
}

/**
 * Load a bout onto a ring's scoreboard.
 *
 * Saves the operator finding the same bout twice — once in the draw and again
 * in a dropdown. The ring is cleared first, because a scoreboard still holding
 * the last bout's presses would start this one part-scored.
 */
export async function sendMatchToRing(formData: FormData) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const matchId = String(formData.get("matchId") || "");
  const ringId = String(formData.get("ringId") || "");
  const eventId = String(formData.get("eventId") || "");
  if (!matchId || !ringId) return;

  const supabase = supabaseAdmin();
  const { data: match } = await supabase.from("event_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) fail("Match not found.");

  const ids = [match.competitor1_registration_id, match.competitor2_registration_id].filter(Boolean) as string[];
  let regs: any[] = [];
  if (ids.length > 0) {
    const { data } = await supabase.from("event_registrations").select("id, competition_number, is_team, team_name, students(full_name)").in("id", ids);
    regs = data ?? [];
  }
  // Typed on the way in rather than inferred: a Map built from a query result
  // has bitten this codebase before, coming out as Map<string, {}>.
  const byId = new Map<string, any>(regs.map((r: any) => [r.id, r] as [string, any]));
  const nameOf = (id: string | null) => (id ? competitorName(byId.get(id) as any) || null : null);
  const numberOf = (id: string | null) => {
    const n = id ? byId.get(id)?.competition_number : null;
    return n != null ? String(n) : null;
  };

  // Nothing is deleted here. Presses belong to the bout they were made in, so
  // loading a new one onto the ring simply changes which presses count -- and
  // the bout that just finished stays readable afterwards.
  const { error } = await supabase
    .from("scoreboard_rings")
    .update({
      match_id: matchId,
      category_id: match.category_id,
      red_name: nameOf(match.competitor1_registration_id),
      blue_name: nameOf(match.competitor2_registration_id),
      red_number: numberOf(match.competitor1_registration_id),
      blue_number: numberOf(match.competitor2_registration_id),
      state: "idle",
      clock_started_at: null,
      current_round: 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ringId);
  if (error) fail(`That bout could not be loaded onto the ring: ${error.message}`);

  redirect(`/events/${eventId}/scoreboard?ring=${ringId}`);
}
