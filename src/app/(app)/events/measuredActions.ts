"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { competitorName } from "@/lib/competitors";
import { measuredKindOf, techniquesFor, type Attempt, type MeasuredKind } from "@/lib/measured";

/**
 * Running a power test or a special technique.
 *
 * Neither is a bout, so neither has a draw. An official works down the entry
 * list calling attempts, and each attempt is a row -- that is the grain the
 * result is actually recorded at, and it means a disputed placing can be taken
 * apart attempt by attempt rather than argued about.
 *
 * Nothing stores a total. The standings are worked out from the attempts every
 * time, the same principle the scoreboard follows: correcting a mis-heard
 * number is one edit, not a recount.
 */

export type MeasuredEntrant = {
  registrationId: string;
  name: string;
  clubName: string | null;
  competitionNumber: string | null;
};

export type MeasuredCategory = {
  categoryId: string;
  eventId: string;
  name: string;
  kind: MeasuredKind;
  /** The techniques this category is running, in order. */
  techniques: string[];
  attemptsPerTechnique: number;
  entrants: MeasuredEntrant[];
  attempts: Attempt[];
};

export async function loadMeasured(input: { categoryId: string }): Promise<MeasuredCategory | null> {
  await requirePermission(PERMISSIONS.EVENT_VIEW);
  const supabase = supabaseAdmin();

  const { data: category } = await supabase
    .from("event_categories")
    .select("id, event_id, name, type, measured_techniques, attempts_per_technique")
    .eq("id", input.categoryId)
    .maybeSingle();
  if (!category) return null;

  const kind = measuredKindOf((category as any).type);
  if (!kind) return null;

  // A category nobody has set up yet runs the discipline's full technique list,
  // which is the common case and saves an organiser a step.
  const chosen: string[] = ((category as any).measured_techniques ?? []).filter(Boolean);
  const techniques = chosen.length > 0 ? chosen : techniquesFor(kind).map((t) => t.key);

  // Only confirmed entrants compete, exactly as the draw only seeds confirmed
  // competitors.
  const { data: regs } = await supabase
    .from("event_registrations")
    .select("id, competition_number, is_team, team_name, clubs(name), students(full_name)")
    .eq("category_id", input.categoryId)
    .eq("status", "confirmed")
    .order("competition_number");

  const entrants: MeasuredEntrant[] = ((regs ?? []) as any[]).map((r) => ({
    registrationId: r.id,
    name: competitorName(r),
    clubName: r.clubs?.name ?? null,
    competitionNumber: r.competition_number != null ? String(r.competition_number) : null,
  }));

  const { data: rows } = await supabase
    .from("event_attempts")
    .select("registration_id, technique, attempt_no, result, scored")
    .eq("category_id", input.categoryId);

  const attempts: Attempt[] = ((rows ?? []) as any[]).map((a) => ({
    registrationId: a.registration_id,
    technique: a.technique,
    attemptNo: Number(a.attempt_no),
    result: Number(a.result),
    scored: a.scored !== false,
  }));

  return {
    categoryId: (category as any).id,
    eventId: (category as any).event_id,
    name: (category as any).name,
    kind,
    techniques,
    attemptsPerTechnique: Number((category as any).attempts_per_technique) || 3,
    entrants,
    attempts,
  };
}

/** Which techniques this category runs, and how many attempts at each. */
export async function setMeasuredSetup(input: {
  categoryId: string;
  techniques: string[];
  attemptsPerTechnique: number;
}): Promise<{ ok: true } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    const supabase = supabaseAdmin();

    const { data: category } = await supabase
      .from("event_categories")
      .select("id, event_id, type")
      .eq("id", input.categoryId)
      .maybeSingle();
    if (!category) return { error: "Category not found." };

    const kind = measuredKindOf((category as any).type);
    if (!kind) return { error: "That category isn't a power test or a special technique." };

    // Only techniques the discipline actually has. This comes off a form and
    // ends up as the key every attempt is filed under, so an unrecognised one
    // would quietly create a column nothing could ever score.
    const allowed = new Set(techniquesFor(kind).map((t) => t.key));
    const techniques = input.techniques.filter((t) => allowed.has(t));
    if (techniques.length === 0) return { error: "Choose at least one technique." };

    const attempts = Math.min(Math.max(1, Math.round(input.attemptsPerTechnique)), 10);

    const { error } = await supabase
      .from("event_categories")
      .update({ measured_techniques: techniques, attempts_per_technique: attempts })
      .eq("id", input.categoryId);
    if (error) return { error: `That could not be saved: ${error.message}` };

    revalidatePath(`/events/${(category as any).event_id}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That could not be saved." };
  }
}

/**
 * Write down one attempt.
 *
 * Upserted on the competitor, the technique and the attempt number, so an
 * official correcting a mis-heard number edits the attempt rather than adding a
 * second one beside it.
 */
export async function recordAttempt(input: {
  categoryId: string;
  registrationId: string;
  technique: string;
  attemptNo: number;
  result: number;
  scored: boolean;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await requirePermission(PERMISSIONS.EVENT_EDIT);
    const supabase = supabaseAdmin();

    const { data: category } = await supabase
      .from("event_categories")
      .select("id, event_id, type, attempts_per_technique")
      .eq("id", input.categoryId)
      .maybeSingle();
    if (!category) return { error: "Category not found." };

    const kind = measuredKindOf((category as any).type);
    if (!kind) return { error: "That category isn't a power test or a special technique." };

    const allowed = new Set(techniquesFor(kind).map((t) => t.key));
    if (!allowed.has(input.technique)) return { error: "That isn't a technique this discipline has." };

    const limit = Number((category as any).attempts_per_technique) || 3;
    if (!Number.isInteger(input.attemptNo) || input.attemptNo < 1 || input.attemptNo > limit) {
      return { error: `This category runs ${limit} attempts at each technique.` };
    }

    const result = Number(input.result);
    if (!Number.isFinite(result) || result < 0) return { error: "That isn't a number this can record." };

    const { error } = await supabase.from("event_attempts").upsert(
      {
        event_id: (category as any).event_id,
        category_id: input.categoryId,
        registration_id: input.registrationId,
        technique: input.technique,
        attempt_no: input.attemptNo,
        // A missed attempt is recorded as taken and worth nothing, which is not
        // the same as an attempt not yet made.
        result: input.scored ? result : 0,
        scored: input.scored,
        recorded_at: new Date().toISOString(),
        // `sub` is the signed-in user's id; who called an attempt matters when
        // one is questioned afterwards.
        recorded_by: session.sub ?? null,
      },
      { onConflict: "registration_id,technique,attempt_no" },
    );
    if (error) return { error: `That attempt didn't save: ${error.message}` };

    revalidatePath(`/events/${(category as any).event_id}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That attempt didn't save." };
  }
}

/** Take an attempt back entirely — as though it had never been called. */
export async function clearAttempt(input: {
  categoryId: string;
  registrationId: string;
  technique: string;
  attemptNo: number;
}): Promise<{ ok: true } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    const supabase = supabaseAdmin();
    const { error } = await supabase
      .from("event_attempts")
      .delete()
      .eq("category_id", input.categoryId)
      .eq("registration_id", input.registrationId)
      .eq("technique", input.technique)
      .eq("attempt_no", input.attemptNo);
    if (error) return { error: "That could not be cleared." };
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That could not be cleared." };
  }
}
