"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireSession } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { makeJoinCode, tally, sideTotal, secondsLeft, type Entry, type ScoreMode, type Side } from "@/lib/scoreboard";

/**
 * Running a ring.
 *
 * Two kinds of caller, deliberately kept apart:
 *
 *   the operator  signed in, sets the bout up and confirms the result
 *   the judges    not signed in, hold a join code, and may only score
 *
 * Referees turn up with their own phones and nobody is creating accounts at the
 * door, so the code is what a judge presents. It grants exactly one thing:
 * pressing a scoring button on that ring. Everything that changes the event
 * itself still needs a login.
 */

export type RingDto = {
  id: string;
  name: string;
  joinCode: string;
  eventId: string;
  categoryId: string | null;
  categoryName: string | null;
  matchId: string | null;
  redName: string | null;
  blueName: string | null;
  mode: ScoreMode;
  judgeCount: number;
  patternBase: number;
  roundSeconds: number;
  rounds: number;
  currentRound: number;
  state: "idle" | "running" | "paused" | "finished";
  clockStartedAt: string | null;
  clockRemaining: number;
  entries: Entry[];
};

const RING_SELECT =
  "id, name, join_code, event_id, category_id, match_id, red_name, blue_name, mode, judge_count, pattern_base, round_seconds, rounds, current_round, state, clock_started_at, clock_remaining, event_categories(name)";

function toDto(ring: any, entries: any[]): RingDto {
  return {
    id: ring.id,
    name: ring.name,
    joinCode: ring.join_code,
    eventId: ring.event_id,
    categoryId: ring.category_id,
    categoryName: ring.event_categories?.name ?? null,
    matchId: ring.match_id,
    redName: ring.red_name,
    blueName: ring.blue_name,
    mode: ring.mode as ScoreMode,
    judgeCount: Number(ring.judge_count) || 5,
    patternBase: Number(ring.pattern_base) || 10,
    roundSeconds: Number(ring.round_seconds) || 120,
    rounds: Number(ring.rounds) || 2,
    currentRound: Number(ring.current_round) || 1,
    state: ring.state,
    clockStartedAt: ring.clock_started_at,
    clockRemaining: Number(ring.clock_remaining) || 0,
    entries: (entries ?? []).map((e: any) => ({
      judge_slot: Number(e.judge_slot),
      side: e.side as Side,
      kind: e.kind,
      value: Number(e.value),
      round: Number(e.round) || 1,
      voided: e.voided === true,
    })),
  };
}

async function readRing(where: { id?: string; joinCode?: string }): Promise<RingDto | null> {
  const supabase = supabaseAdmin();
  const query = supabase.from("scoreboard_rings").select(RING_SELECT);
  const { data: ring } = where.id
    ? await query.eq("id", where.id).maybeSingle()
    : await query.eq("join_code", String(where.joinCode ?? "").toUpperCase()).maybeSingle();
  if (!ring) return null;

  // Only the bout in progress: last night's presses aren't part of this score.
  const { data: entries } = await supabase
    .from("scoreboard_entries")
    .select("judge_slot, side, kind, value, round, voided")
    .eq("ring_id", ring.id)
    .eq("round", (ring as any).current_round)
    .order("created_at");

  return toDto(ring, entries ?? []);
}

/**
 * Everything a screen needs, whether it came in by link or by join code.
 *
 * A join code is its own permission — that's the point of it, and a judge has
 * no login. Asking by ring id is the organiser's route, so that one needs a
 * session behind it.
 */
export async function loadRing(input: { ringId?: string; joinCode?: string }): Promise<RingDto | null> {
  if (input.joinCode) return readRing({ joinCode: input.joinCode });
  await requireSession();
  return readRing({ id: input.ringId });
}

export async function createRing(formData: FormData) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const eventId = String(formData.get("eventId") || "");
  const name = String(formData.get("name") || "").trim() || "Ring 1";
  if (!eventId) return;

  const supabase = supabaseAdmin();
  // A clash on the code is possible but vanishingly unlikely; retrying once is
  // cheaper than a loop nobody will ever exercise.
  for (const code of [makeJoinCode(), makeJoinCode()]) {
    const { error } = await supabase.from("scoreboard_rings").insert({ event_id: eventId, name, join_code: code });
    if (!error) break;
  }
  revalidatePath(`/events/${eventId}/scoreboard`);
}

export async function updateRing(input: {
  ringId: string;
  patch: Partial<{
    name: string;
    categoryId: string | null;
    matchId: string | null;
    redName: string | null;
    blueName: string | null;
    mode: ScoreMode;
    judgeCount: number;
    patternBase: number;
    roundSeconds: number;
    rounds: number;
  }>;
}): Promise<{ ok: true; ring: RingDto } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    const p = input.patch;
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (p.name !== undefined) row.name = p.name.trim() || "Ring";
    if (p.categoryId !== undefined) row.category_id = p.categoryId || null;
    if (p.matchId !== undefined) row.match_id = p.matchId || null;
    if (p.redName !== undefined) row.red_name = p.redName;
    if (p.blueName !== undefined) row.blue_name = p.blueName;
    if (p.mode !== undefined) row.mode = p.mode;
    if (p.judgeCount !== undefined) row.judge_count = Math.min(Math.max(1, p.judgeCount), 9);
    if (p.patternBase !== undefined) row.pattern_base = Math.max(0, p.patternBase);
    if (p.roundSeconds !== undefined) row.round_seconds = Math.max(10, p.roundSeconds);
    if (p.rounds !== undefined) row.rounds = Math.max(1, p.rounds);

    const supabase = supabaseAdmin();
    const { error } = await supabase.from("scoreboard_rings").update(row).eq("id", input.ringId);
    if (error) return { error: "That change could not be saved." };

    const ring = await readRing({ id: input.ringId });
    if (!ring) return { error: "Ring not found." };
    return { ok: true, ring };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That change could not be saved." };
  }
}

/** Start, pause or reset the clock. */
export async function setClock(input: {
  ringId: string;
  action: "start" | "pause" | "reset" | "finish";
}): Promise<{ ok: true; ring: RingDto } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    const supabase = supabaseAdmin();
    const current = await readRing({ id: input.ringId });
    if (!current) return { error: "Ring not found." };

    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.action === "start") {
      // Starting from a finished or fresh ring puts a full round back on.
      const remaining =
        current.state === "paused" && current.clockRemaining > 0 ? current.clockRemaining : current.roundSeconds;
      row.state = "running";
      row.clock_started_at = new Date().toISOString();
      row.clock_remaining = remaining;
    } else if (input.action === "pause") {
      row.state = "paused";
      row.clock_started_at = null;
      row.clock_remaining = secondsLeft({
        state: current.state,
        startedAt: current.clockStartedAt,
        remaining: current.clockRemaining,
      });
    } else if (input.action === "reset") {
      row.state = "idle";
      row.clock_started_at = null;
      row.clock_remaining = current.roundSeconds;
    } else {
      row.state = "finished";
      row.clock_started_at = null;
      row.clock_remaining = 0;
    }

    const { error } = await supabase.from("scoreboard_rings").update(row).eq("id", input.ringId);
    if (error) return { error: "The clock could not be changed." };
    const ring = await readRing({ id: input.ringId });
    return ring ? { ok: true, ring } : { error: "Ring not found." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The clock could not be changed." };
  }
}

/**
 * A judge presses a button.
 *
 * Authenticated by the join code rather than a session. The code is checked
 * against the ring being scored, so a code for one mat can't be used to score
 * another.
 */
export async function judgePress(input: {
  joinCode: string;
  judgeSlot: number;
  side: Side;
  value: number;
  kind: "point" | "deduction" | "flag";
}): Promise<{ ok: true; ring: RingDto } | { error: string }> {
  try {
    const ring = await readRing({ joinCode: input.joinCode });
    if (!ring) return { error: "That code doesn't match a ring." };
    if (input.judgeSlot < 1 || input.judgeSlot > ring.judgeCount) return { error: "That judge number isn't on this ring." };
    if (ring.state === "finished") return { error: "This bout is finished." };

    const supabase = supabaseAdmin();
    const { error } = await supabase.from("scoreboard_entries").insert({
      ring_id: ring.id,
      match_id: ring.matchId,
      judge_slot: input.judgeSlot,
      side: input.side,
      kind: input.kind,
      value: input.value,
      round: ring.currentRound,
    });
    if (error) return { error: "That score didn't register. Try again." };

    const updated = await readRing({ id: ring.id });
    return updated ? { ok: true, ring: updated } : { error: "Ring not found." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That score didn't register." };
  }
}

/** Take back a judge's last press. The row is kept, marked void. */
export async function judgeUndo(input: {
  joinCode: string;
  judgeSlot: number;
}): Promise<{ ok: true; ring: RingDto } | { error: string }> {
  try {
    const ring = await readRing({ joinCode: input.joinCode });
    if (!ring) return { error: "That code doesn't match a ring." };

    const supabase = supabaseAdmin();
    const { data: last } = await supabase
      .from("scoreboard_entries")
      .select("id")
      .eq("ring_id", ring.id)
      .eq("judge_slot", input.judgeSlot)
      .eq("round", ring.currentRound)
      .eq("voided", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last) return { error: "Nothing to take back." };

    await supabase.from("scoreboard_entries").update({ voided: true }).eq("id", last.id);
    const updated = await readRing({ id: ring.id });
    return updated ? { ok: true, ring: updated } : { error: "Ring not found." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That could not be undone." };
  }
}

/** Clear the bout and put a fresh round on the clock. */
export async function clearRing(input: { ringId: string }): Promise<{ ok: true; ring: RingDto } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    const supabase = supabaseAdmin();
    await supabase.from("scoreboard_entries").delete().eq("ring_id", input.ringId);
    const current = await readRing({ id: input.ringId });
    await supabase
      .from("scoreboard_rings")
      .update({
        state: "idle",
        clock_started_at: null,
        clock_remaining: current?.roundSeconds ?? 120,
        current_round: 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.ringId);
    const ring = await readRing({ id: input.ringId });
    return ring ? { ok: true, ring } : { error: "Ring not found." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The ring could not be cleared." };
  }
}

/**
 * Write the result into the draw.
 *
 * The bracket stores whole numbers, so what goes in is the judge tally — 3–2
 * rather than an averaged 9.62 — which is both a fair summary and always
 * separates a winner. Every press stays in the scoreboard tables, so a
 * disputed bout can still be recounted in full.
 */
export async function confirmResult(input: { ringId: string }): Promise<{ ok: true; message: string } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    const ring = await readRing({ id: input.ringId });
    if (!ring) return { error: "Ring not found." };

    const result = tally(ring.entries, ring.judgeCount, ring.mode, ring.patternBase);
    if (!result.winner) return { error: "The judges are tied — the referee has to separate them before this can be saved." };
    if (!ring.matchId) {
      return { error: "This ring isn't attached to a bout in the draw, so there is nowhere to save it." };
    }

    const supabase = supabaseAdmin();
    const { data: match } = await supabase.from("event_matches").select("*").eq("id", ring.matchId).maybeSingle();
    if (!match) return { error: "That bout is no longer in the draw." };
    if (!match.competitor1_registration_id || !match.competitor2_registration_id) {
      return { error: "Both competitors must be in the draw before a result can be saved." };
    }

    // Red is competitor 1, blue is competitor 2, matching how the draw is drawn.
    const winnerId = result.winner === "red" ? match.competitor1_registration_id : match.competitor2_registration_id;
    const loserId = result.winner === "red" ? match.competitor2_registration_id : match.competitor1_registration_id;

    await supabase
      .from("event_matches")
      .update({
        competitor1_points: result.red,
        competitor2_points: result.blue,
        winner_registration_id: winnerId,
      })
      .eq("id", ring.matchId);

    // Carry the winner — and, in a double-elimination draw, the loser — onward.
    if (match.next_match_id) {
      const field = match.next_slot === 1 ? "competitor1_registration_id" : "competitor2_registration_id";
      await supabase.from("event_matches").update({ [field]: winnerId }).eq("id", match.next_match_id);
    }
    if (match.loser_next_match_id) {
      const field = match.loser_next_slot === 1 ? "competitor1_registration_id" : "competitor2_registration_id";
      await supabase.from("event_matches").update({ [field]: loserId }).eq("id", match.loser_next_match_id);
    }

    await supabase
      .from("scoreboard_rings")
      .update({ state: "finished", clock_started_at: null, updated_at: new Date().toISOString() })
      .eq("id", input.ringId);

    revalidatePath(`/events/${ring.eventId}/scoreboard`);
    if (ring.categoryId) {
      revalidatePath(`/events/${ring.eventId}/categories/${ring.categoryId}/bracket`);
      revalidatePath(`/public/events/${ring.eventId}/categories/${ring.categoryId}/bracket`);
    }

    const name = result.winner === "red" ? ring.redName : ring.blueName;
    return { ok: true, message: `${name ?? result.winner.toUpperCase()} wins ${result.red}–${result.blue}. Saved to the draw.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The result could not be saved." };
  }
}

export async function deleteRing(formData: FormData) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);
  const ringId = String(formData.get("ringId") || "");
  const eventId = String(formData.get("eventId") || "");
  if (!ringId) return;
  await supabaseAdmin().from("scoreboard_rings").delete().eq("id", ringId);
  revalidatePath(`/events/${eventId}/scoreboard`);
}
