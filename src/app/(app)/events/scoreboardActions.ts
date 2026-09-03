"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireSession } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { makeJoinCode, tally, boutOver, secondsLeft, type Entry, type ScoreMode, type Side } from "@/lib/scoreboard";
import { parseTheme, DEFAULT_THEME, type ScoreboardTheme } from "@/lib/scoreboardTheme";

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
  redNumber: string | null;
  blueNumber: string | null;
  patternName: string | null;
  mode: ScoreMode;
  judgeCount: number;
  patternBase: number;
  roundSeconds: number;
  rounds: number;
  currentRound: number;
  state: "idle" | "running" | "paused" | "finished";
  clockStartedAt: string | null;
  clockRemaining: number;
  /**
   * The server's own time, as of this reply.
   *
   * The clock is stored as "started at this instant, with this much left", and
   * the instant is the server's. A screen that measured it against its own
   * clock measured the gap between the two machines as well: a hall laptop a
   * few seconds slow started a 120-second round at 2:05. Every screen corrects
   * for the difference using this.
   */
  serverNow: string;
  entries: Entry[];
  /**
   * How this event's screens should look.
   *
   * Sent with the ring rather than fetched separately, so the display, the
   * judge's pad and the Android app all get it from the one call they already
   * make — a change on the designer then reaches every screen in the hall on
   * their next refresh, without anybody reloading anything.
   */
  theme: ScoreboardTheme;
};

const RING_SELECT =
  "id, name, join_code, event_id, category_id, match_id, red_name, blue_name, red_number, blue_number, pattern_name, mode, judge_count, pattern_base, round_seconds, rounds, current_round, state, clock_started_at, clock_remaining, event_categories(name)";

function toDto(ring: any, entries: any[], theme: ScoreboardTheme = DEFAULT_THEME): RingDto {
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
    redNumber: ring.red_number,
    blueNumber: ring.blue_number,
    patternName: ring.pattern_name,
    mode: ring.mode as ScoreMode,
    judgeCount: Number(ring.judge_count) || 5,
    patternBase: Number(ring.pattern_base) || 10,
    roundSeconds: Number(ring.round_seconds) || 120,
    rounds: Number(ring.rounds) || 2,
    currentRound: Number(ring.current_round) || 1,
    state: ring.state,
    clockStartedAt: ring.clock_started_at,
    serverNow: new Date().toISOString(),
    // A ring nobody has started yet has no clock stored; it shows a full round
    // rather than 0:00, which would read as "time up" before anyone began.
    clockRemaining: ring.clock_remaining == null ? Number(ring.round_seconds) || 120 : Number(ring.clock_remaining),
    entries: (entries ?? []).map((e: any) => ({
      judge_slot: Number(e.judge_slot),
      side: e.side as Side,
      kind: e.kind,
      value: Number(e.value),
      round: Number(e.round) || 1,
      voided: e.voided === true,
    })),
    theme,
  };
}

/** This event's look, or the house style, or the built-in one. */
async function themeFor(supabase: any, eventId: string): Promise<ScoreboardTheme> {
  const { data: own } = await supabase
    .from("scoreboard_themes")
    .select("settings")
    .eq("event_id", eventId)
    .maybeSingle();
  if (own) return parseTheme(own.settings);

  const { data: house } = await supabase
    .from("scoreboard_themes")
    .select("settings")
    .is("event_id", null)
    .maybeSingle();
  return house ? parseTheme(house.settings) : DEFAULT_THEME;
}

/**
 * Just enough of a ring to check a code and place a press against it.
 *
 * One query, and none of the parts a screen needs: no entries, no theme, no
 * category name. A press used to cost a full read to authenticate and another
 * to answer with, which on a busy mat was five queries a button.
 */
const RING_GUARD_SELECT =
  "id, event_id, match_id, judge_count, current_round, rounds, state, clock_started_at, clock_remaining";

type RingGuard = {
  id: string;
  eventId: string;
  matchId: string | null;
  judgeCount: number;
  currentRound: number;
  over: boolean;
};

async function readRingGuard(joinCode: string): Promise<RingGuard | null> {
  const supabase = supabaseAdmin();
  const { data: ring } = await supabase
    .from("scoreboard_rings")
    .select(RING_GUARD_SELECT)
    .eq("join_code", String(joinCode ?? "").toUpperCase())
    .maybeSingle();
  if (!ring) return null;

  const over = await settleIfOver(supabase, ring);
  return {
    id: (ring as any).id,
    eventId: (ring as any).event_id,
    matchId: (ring as any).match_id,
    judgeCount: Number((ring as any).judge_count) || 5,
    currentRound: Number((ring as any).current_round) || 1,
    over,
  };
}

/**
 * End the bout if its time is up, and say whether it has ended.
 *
 * "Finished" was only ever a state somebody pressed. The last round's clock
 * would run out, the display would paint a winner, and the ring row still said
 * `running` — so the judges' pads kept taking presses and could move a result
 * the hall had already seen called.
 *
 * Time up on the final round ends the bout whether or not the operator has got
 * to the button, so it is settled here, on the server, once: the write is
 * guarded on the old state, so the many screens polling at the same moment
 * produce one update between them and every later read simply sees `finished`.
 */
async function settleIfOver(supabase: any, ring: any): Promise<boolean> {
  const over = boutOver({
    state: ring.state,
    startedAt: ring.clock_started_at,
    remaining: ring.clock_remaining == null ? 0 : Number(ring.clock_remaining),
    currentRound: Number(ring.current_round) || 1,
    rounds: Number(ring.rounds) || 1,
  });
  if (!over || ring.state === "finished") return over;

  await supabase
    .from("scoreboard_rings")
    .update({ state: "finished", clock_started_at: null, clock_remaining: 0, updated_at: new Date().toISOString() })
    .eq("id", ring.id)
    .neq("state", "finished");
  ring.state = "finished";
  ring.clock_started_at = null;
  ring.clock_remaining = 0;
  return true;
}

async function readRing(where: { id?: string; joinCode?: string }): Promise<RingDto | null> {
  const supabase = supabaseAdmin();
  const query = supabase.from("scoreboard_rings").select(RING_SELECT);
  const { data: ring } = where.id
    ? await query.eq("id", where.id).maybeSingle()
    : await query.eq("join_code", String(where.joinCode ?? "").toUpperCase()).maybeSingle();
  if (!ring) return null;

  await settleIfOver(supabase, ring);

  // The whole bout, not just the round on the clock. A sparring score carries
  // from round one into round two, and a warning given in the first round is
  // still against that competitor in the last. Which round a press came from is
  // kept on the row for the record; it just doesn't narrow the score.
  //
  // Scoped by bout, not by ring. A ring runs bouts all day, and every press it
  // has ever taken is still in the table -- so the current score is the presses
  // belonging to the bout now loaded. That is also what makes a finished bout
  // readable again afterwards: nothing was ever thrown away to make room.
  const pressed = supabase
    .from("scoreboard_entries")
    .select("judge_slot, side, kind, value, round, voided")
    .eq("ring_id", ring.id);
  const { data: entries } = (ring as any).match_id
    ? await pressed.eq("match_id", (ring as any).match_id).order("created_at")
    : await pressed.is("match_id", null).order("created_at");

  return toDto(ring, entries ?? [], await themeFor(supabase, (ring as any).event_id));
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
    redNumber: string | null;
    blueNumber: string | null;
    patternName: string | null;
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
    if (p.redNumber !== undefined) row.red_number = p.redNumber;
    if (p.blueNumber !== undefined) row.blue_number = p.blueNumber;
    if (p.patternName !== undefined) row.pattern_name = p.patternName;
    if (p.mode !== undefined) row.mode = p.mode;
    if (p.judgeCount !== undefined) row.judge_count = Math.min(Math.max(1, p.judgeCount), 9);
    if (p.patternBase !== undefined) row.pattern_base = Math.max(0, p.patternBase);
    if (p.roundSeconds !== undefined) row.round_seconds = Math.max(10, p.roundSeconds);
    if (p.rounds !== undefined) row.rounds = Math.max(1, p.rounds);

    const supabase = supabaseAdmin();

    // Setting the round length puts it on the clock straight away, unless a
    // bout is actually running — nobody means "make rounds two minutes" and
    // expects the board to keep showing 0:00 from the last bout until they
    // find the Reset button.
    if (row.round_seconds !== undefined) {
      const before = await readRing({ id: input.ringId });
      if (before && before.state !== "running") {
        row.clock_started_at = null;
        row.clock_remaining = row.round_seconds;
      }
    }
    const { error } = await supabase.from("scoreboard_rings").update(row).eq("id", input.ringId);
    if (error) return { error: `That change could not be saved: ${error.message}` };

    const ring = await readRing({ id: input.ringId });
    if (!ring) return { error: "Ring not found." };
    return { ok: true, ring };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That change could not be saved." };
  }
}

/** Start, pause or reset the clock, or move on to the next round. */
export async function setClock(input: {
  ringId: string;
  action: "start" | "pause" | "reset" | "finish" | "nextRound" | "extraRound";
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
    } else if (input.action === "nextRound") {
      // A fresh clock, but the same score: rounds add up, they don't start over.
      if (current.currentRound >= current.rounds) return { error: "That was the last round." };
      row.current_round = current.currentRound + 1;
      row.state = "idle";
      row.clock_started_at = null;
      row.clock_remaining = current.roundSeconds;
    } else if (input.action === "extraRound") {
      // ITF breaks a level bout with an extra round before anyone decides it on
      // superiority. The bout gains a round rather than restarting: the score
      // carries, so what the extra round settles is the difference.
      const level = tally(current.entries, current.judgeCount, current.mode, current.patternBase);
      if (level.red !== level.blue) return { error: "The judges have separated them — no extra round is needed." };
      row.rounds = current.rounds + 1;
      row.current_round = current.rounds + 1;
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
  /**
   * A name the device gave this press, so a retry after a dropped connection is
   * recognised as the same press rather than counted again. Web judges don't
   * send one — their press either went or visibly didn't.
   */
  clientId?: string;
  /**
   * The bout the judge believed they were scoring. A press queued on a phone
   * during one bout must not land on the next one, so it is checked against
   * what the ring is showing now and refused if the ring has moved on.
   */
  expectedMatchId?: string | null;
}): Promise<{ ok: true; ring: RingDto } | { error: string; stale?: boolean }> {
  try {
    const ring = await readRingGuard(input.joinCode);
    if (!ring) return { error: "That code doesn't match a ring." };
    if (input.judgeSlot < 1 || input.judgeSlot > ring.judgeCount) return { error: "That judge number isn't on this ring." };
    // Time up on the final round ends the bout, whether or not anybody has
    // pressed the button — a press after that would move a result the hall has
    // already seen called.
    if (ring.over) return { error: "This bout is finished.", stale: true };

    if (input.expectedMatchId !== undefined && (input.expectedMatchId ?? null) !== ring.matchId) {
      return { error: "The ring has moved on to another bout, so that press was dropped.", stale: true };
    }

    const supabase = supabaseAdmin();
    const { error } = await supabase.from("scoreboard_entries").insert({
      ring_id: ring.id,
      match_id: ring.matchId,
      judge_slot: input.judgeSlot,
      side: input.side,
      kind: input.kind,
      value: input.value,
      round: ring.currentRound,
      client_id: input.clientId ?? null,
    });

    // A repeat of a press that already arrived is success, not failure: the
    // phone is asking "did this land?" and the answer is yes.
    if (error && (error as any).code === "23505") {
      const already = await readRing({ id: ring.id });
      return already ? { ok: true, ring: already } : { error: "Ring not found." };
    }
    if (error) return { error: `That score didn't register: ${error.message}` };

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
    const ring = await readRingGuard(input.joinCode);
    if (!ring) return { error: "That code doesn't match a ring." };

    const supabase = supabaseAdmin();

    // Unlike a press, an undo is still allowed after the bell — a judge who
    // mis-pressed at 0:02 has no other way to withdraw it, and the alternative
    // is clearing the bout and losing every judge's marks with it. What closes
    // the door is the result being confirmed: after that the bout belongs to
    // the draw, and changing it is the jury's business rather than a judge's.
    // Nothing is lost either way, since an undo voids the row rather than
    // deleting it.
    if (ring.matchId) {
      const { data: confirmed } = await supabase
        .from("scoreboard_results")
        .select("match_id")
        .eq("match_id", ring.matchId)
        .maybeSingle();
      if (confirmed) return { error: "This result has been confirmed — ask the ring official." };
    }

    // Narrowed to this bout as well as this round: a ring keeps every press it
    // has ever taken, so without it an undo at the start of a bout would reach
    // back into the last one.
    let recent = supabase
      .from("scoreboard_entries")
      .select("id")
      .eq("ring_id", ring.id)
      .eq("judge_slot", input.judgeSlot)
      .eq("round", ring.currentRound)
      .eq("voided", false);
    recent = ring.matchId ? recent.eq("match_id", ring.matchId) : recent.is("match_id", null);
    const { data: last } = await recent.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!last) return { error: "Nothing to take back." };

    await supabase.from("scoreboard_entries").update({ voided: true }).eq("id", last.id);
    const updated = await readRing({ id: ring.id });
    return updated ? { ok: true, ring: updated } : { error: "Ring not found." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That could not be undone." };
  }
}

/**
 * The referee calls a warning or a deduction.
 *
 * This is the operator's button, not a judge's: warnings and deductions are the
 * referee's ruling on the bout, so they are recorded against slot 0 and count
 * against every judge's score alike. Three warnings make a point; a deduction
 * is a point straight away.
 */
export async function refereePress(input: {
  ringId: string;
  side: Side;
  /**
   * `decision` is the superiority call that settles a bout the judges have left
   * level — ITF's last resort, after the extra round. It carries no points and
   * only counts when the judges are tied, so giving one on a bout that already
   * has a winner changes nothing.
   */
  kind: "warning" | "penalty" | "decision";
}): Promise<{ ok: true; ring: RingDto } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    const ring = await readRing({ id: input.ringId });
    if (!ring) return { error: "Ring not found." };

    const supabase = supabaseAdmin();
    const { error } = await supabase.from("scoreboard_entries").insert({
      ring_id: ring.id,
      match_id: ring.matchId,
      judge_slot: 0,
      side: input.side,
      kind: input.kind,
      value: 0,
      round: ring.currentRound,
    });
    // The database's own words, not a shrug: a rejected insert here once looked
    // exactly like a dead button, and the reason was a constraint.
    if (error) return { error: `That didn't register: ${error.message}` };

    const updated = await readRing({ id: ring.id });
    return updated ? { ok: true, ring: updated } : { error: "Ring not found." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That didn't register." };
  }
}

/** Take back the last warning or deduction called against a side. */
export async function refereeUndo(input: {
  ringId: string;
  side: Side;
}): Promise<{ ok: true; ring: RingDto } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    const supabase = supabaseAdmin();
    const current = await readRing({ id: input.ringId });
    if (!current) return { error: "Ring not found." };
    // Warnings and deductions only. A superiority decision is taken back by
    // giving the other one, or by clearing it outright — undoing it as though
    // it were the last warning would be a surprising way to change a result.
    let recent = supabase
      .from("scoreboard_entries")
      .select("id")
      .eq("ring_id", input.ringId)
      .eq("judge_slot", 0)
      .eq("side", input.side)
      .neq("kind", "decision")
      .eq("voided", false);
    recent = current.matchId ? recent.eq("match_id", current.matchId) : recent.is("match_id", null);
    const { data: last } = await recent.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!last) return { error: "Nothing to take back." };

    await supabase.from("scoreboard_entries").update({ voided: true }).eq("id", last.id);
    const ring = await readRing({ id: input.ringId });
    return ring ? { ok: true, ring } : { error: "Ring not found." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That could not be undone." };
  }
}

/**
 * Withdraw the superiority decision.
 *
 * Its own action rather than part of the undo, because it is the one referee
 * press that decides a bout on its own. Every decision ever given on this bout
 * is voided, so the bout goes back to being level rather than falling back to
 * whichever one was given first.
 */
export async function clearDecision(input: { ringId: string }): Promise<{ ok: true; ring: RingDto } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    const supabase = supabaseAdmin();
    const current = await readRing({ id: input.ringId });
    if (!current) return { error: "Ring not found." };

    let calls = supabase
      .from("scoreboard_entries")
      .update({ voided: true })
      .eq("ring_id", input.ringId)
      .eq("judge_slot", 0)
      .eq("kind", "decision")
      .eq("voided", false);
    const { error } = current.matchId ? await calls.eq("match_id", current.matchId) : await calls.is("match_id", null);
    if (error) return { error: "That could not be withdrawn." };

    const ring = await readRing({ id: input.ringId });
    return ring ? { ok: true, ring } : { error: "Ring not found." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That could not be withdrawn." };
  }
}

/**
 * Clear the bout and put a fresh round on the clock.
 *
 * Only this bout's presses go, and only because the operator asked -- a bout
 * being restarted after a mistake. Loading the next bout onto the ring doesn't
 * come through here, so the record of everything already fought survives.
 */
export async function clearRing(input: { ringId: string }): Promise<{ ok: true; ring: RingDto } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    const supabase = supabaseAdmin();
    const current = await readRing({ id: input.ringId });
    const wipe = supabase.from("scoreboard_entries").delete().eq("ring_id", input.ringId);
    // Only this bout's presses. Everything the ring scored earlier belongs to
    // other matches and stays where it is.
    const { error: wipeError } = current?.matchId
      ? await wipe.eq("match_id", current.matchId)
      : await wipe.is("match_id", null);
    if (wipeError) return { error: `The bout could not be cleared: ${wipeError.message}` };
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
    if (!result.winner) {
      return {
        error:
          "The judges are level. Fight an extra round, or give a superiority decision — either one settles it and this can then be saved.",
      };
    }
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

    // Freeze what the bout was scored under, so it can be read back exactly as
    // it was called even after the ring has been reset for the next one.
    await supabase.from("scoreboard_results").upsert(
      {
        match_id: ring.matchId,
        ring_id: ring.id,
        mode: ring.mode,
        judge_count: ring.judgeCount,
        pattern_base: ring.patternBase,
        rounds: ring.currentRound,
        red_name: ring.redName,
        blue_name: ring.blueName,
        red_number: ring.redNumber,
        blue_number: ring.blueNumber,
        pattern_name: ring.patternName,
        red_votes: result.red,
        blue_votes: result.blue,
        // A bout the judges left level and the referee settled reads as a draw
        // in the votes alone. Recorded so the result sheet can say how it was
        // won rather than showing 2–2 next to a winner's name.
        by_decision: result.byDecision,
        winner_registration_id: winnerId,
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: "match_id" },
    );

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
    const how = result.byDecision
      ? `wins on the referee's decision (judges level ${result.red}–${result.blue})`
      : `wins ${result.red}–${result.blue}`;
    return { ok: true, message: `${name ?? result.winner.toUpperCase()} ${how}. Saved to the draw.` };
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

export type MatchRecord = {
  matchId: string;
  mode: ScoreMode;
  judgeCount: number;
  patternBase: number;
  rounds: number;
  redName: string | null;
  blueName: string | null;
  redNumber: string | null;
  blueNumber: string | null;
  patternName: string | null;
  redVotes: number;
  blueVotes: number;
  winnerRegistrationId: string | null;
  confirmedAt: string;
  entries: Entry[];
};

/**
 * A finished bout, read back.
 *
 * Every press ever made is still in the table, so this is a lookup rather than
 * a reconstruction: the presses come from scoreboard_entries by match, and the
 * settings they were scored under from the row written when the result was
 * confirmed. Nothing is inferred, so a bout questioned a week later shows the
 * same numbers the hall saw.
 */
export async function loadMatchRecord(input: { matchId: string }): Promise<MatchRecord | null> {
  await requireSession();
  const supabase = supabaseAdmin();

  const { data: saved } = await supabase
    .from("scoreboard_results")
    .select("*")
    .eq("match_id", input.matchId)
    .maybeSingle();
  if (!saved) return null;

  const { data: entries } = await supabase
    .from("scoreboard_entries")
    .select("judge_slot, side, kind, value, round, voided")
    .eq("match_id", input.matchId)
    .order("created_at");

  return {
    matchId: input.matchId,
    mode: saved.mode as ScoreMode,
    judgeCount: Number(saved.judge_count) || 5,
    patternBase: Number(saved.pattern_base) || 10,
    rounds: Number(saved.rounds) || 1,
    redName: saved.red_name,
    blueName: saved.blue_name,
    redNumber: saved.red_number,
    blueNumber: saved.blue_number,
    patternName: saved.pattern_name,
    redVotes: Number(saved.red_votes) || 0,
    blueVotes: Number(saved.blue_votes) || 0,
    winnerRegistrationId: saved.winner_registration_id,
    confirmedAt: saved.confirmed_at,
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
