"use server";

import { revalidatePath } from "next/cache";
import { messageFrom } from "@/lib/controlFlow";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { REFEREE_SLOT, type OfficialRole } from "@/lib/officials";

/**
 * The umpire panel.
 *
 * Two things, kept apart: who is officiating at this event at all, and who is
 * sitting in which seat on which ring right now. The first changes once, at the
 * start; the second changes all day as panels rotate.
 */

export type OfficialDto = {
  id: string;
  fullName: string;
  studentId: string | null;
  clubId: string | null;
  clubName: string | null;
  country: string | null;
  qualification: string | null;
  role: OfficialRole;
  notes: string | null;
  /** Where they are sitting, if anywhere: ring name and seat. */
  seat: { ringId: string; ringName: string; slot: number } | null;
};

export async function loadOfficials(eventId: string): Promise<OfficialDto[]> {
  await requirePermission(PERMISSIONS.EVENT_VIEW);
  const supabase = supabaseAdmin();

  const { data: rows } = await supabase
    .from("event_officials")
    .select("id, full_name, student_id, club_id, country, qualification, role, notes, clubs(name)")
    .eq("event_id", eventId)
    .order("role")
    .order("full_name");
  if (!rows || rows.length === 0) return [];

  const { data: seats } = await supabase
    .from("ring_officials")
    .select("official_id, judge_slot, ring_id, scoreboard_rings(name)")
    .in("official_id", rows.map((r: any) => r.id));

  const seatOf = new Map<string, OfficialDto["seat"]>(
    ((seats ?? []) as any[]).map((s) => [
      s.official_id,
      { ringId: s.ring_id, ringName: s.scoreboard_rings?.name ?? "Ring", slot: Number(s.judge_slot) },
    ]),
  );

  return (rows as any[]).map((r) => ({
    id: r.id,
    fullName: r.full_name,
    studentId: r.student_id,
    clubId: r.club_id,
    clubName: r.clubs?.name ?? null,
    country: r.country,
    qualification: r.qualification,
    role: r.role as OfficialRole,
    notes: r.notes,
    seat: seatOf.get(r.id) ?? null,
  }));
}

export async function saveOfficial(input: {
  eventId: string;
  officialId?: string;
  fullName: string;
  studentId: string | null;
  clubId: string | null;
  country: string | null;
  qualification: string | null;
  role: OfficialRole;
  notes: string | null;
}): Promise<{ ok: true } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    const fullName = input.fullName.trim();
    if (!fullName) return { error: "An official needs a name." };

    const row = {
      event_id: input.eventId,
      full_name: fullName,
      student_id: input.studentId || null,
      club_id: input.clubId || null,
      country: input.country?.trim() || null,
      qualification: input.qualification?.trim() || null,
      role: input.role,
      notes: input.notes?.trim() || null,
    };

    const supabase = supabaseAdmin();
    const { error } = input.officialId
      ? await supabase.from("event_officials").update(row).eq("id", input.officialId)
      : await supabase.from("event_officials").insert(row);
    if (error) return { error: `That official could not be saved: ${error.message}` };

    revalidatePath(`/events/${input.eventId}`);
    return { ok: true };
  } catch (e) {
    return { error: messageFrom(e, "That official could not be saved.") };
  }
}

export async function deleteOfficial(input: {
  eventId: string;
  officialId: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    // Their seat goes with them by cascade; every result they have already
    // judged keeps its own copy of the panel, so nothing is lost from the
    // record.
    const { error } = await supabaseAdmin().from("event_officials").delete().eq("id", input.officialId);
    if (error) return { error: "That official could not be removed." };
    revalidatePath(`/events/${input.eventId}`);
    return { ok: true };
  } catch (e) {
    return { error: messageFrom(e, "That official could not be removed.") };
  }
}

/**
 * Seat an official on a ring, or clear a seat.
 *
 * Passing no official empties the seat. Seating somebody who is already on this
 * ring moves them rather than listing them twice, and seating into an occupied
 * seat replaces whoever was there — which is what "swap the panel over" means
 * in practice, and doing it as delete-then-insert avoids the unique constraints
 * tripping over an intermediate state.
 */
export async function seatOfficial(input: {
  eventId: string;
  ringId: string;
  slot: number;
  officialId: string | null;
}): Promise<{ ok: true } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    const supabase = supabaseAdmin();

    if (!Number.isInteger(input.slot) || input.slot < REFEREE_SLOT || input.slot > 9) {
      return { error: "That isn't a seat on this ring." };
    }

    await supabase.from("ring_officials").delete().eq("ring_id", input.ringId).eq("judge_slot", input.slot);

    if (input.officialId) {
      await supabase.from("ring_officials").delete().eq("ring_id", input.ringId).eq("official_id", input.officialId);
      const { error } = await supabase.from("ring_officials").insert({
        ring_id: input.ringId,
        official_id: input.officialId,
        judge_slot: input.slot,
      });
      if (error) return { error: `That seat could not be filled: ${error.message}` };
    }

    revalidatePath(`/events/${input.eventId}`);
    return { ok: true };
  } catch (e) {
    return { error: messageFrom(e, "That seat could not be changed.") };
  }
}
