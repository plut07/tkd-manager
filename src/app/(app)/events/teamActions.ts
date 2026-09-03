"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";

/**
 * Entering a team.
 *
 * A team is a registration, like every other competitor -- see 0043_teams.sql
 * for why. What is different is only how it comes into being: it is assembled
 * from students who are already on the system, given a name, and entered
 * against a club. Everything after that -- the draw, the seeding, the
 * competition number, the scoreboard -- treats it as one entrant and never
 * needs to know.
 */

export type TeamMemberInput = { studentId: string; isReserve: boolean };

/** A club's team in one category. Members in the order they compete. */
export type TeamDto = {
  registrationId: string;
  name: string;
  clubId: string | null;
  clubName: string | null;
  status: string;
  competitionNumber: string | null;
  members: { studentId: string; fullName: string; isReserve: boolean; position: number }[];
};

export async function loadTeams(input: { categoryId: string }): Promise<TeamDto[]> {
  await requirePermission(PERMISSIONS.EVENT_VIEW);
  const supabase = supabaseAdmin();

  const { data: rows } = await supabase
    .from("event_registrations")
    .select("id, team_name, club_id, status, competition_number, clubs(name)")
    .eq("category_id", input.categoryId)
    .eq("is_team", true)
    .order("registered_at");
  if (!rows || rows.length === 0) return [];

  // One query for every team's members rather than one per team.
  const { data: members } = await supabase
    .from("event_team_members")
    .select("registration_id, student_id, position, is_reserve, students(full_name)")
    .in(
      "registration_id",
      rows.map((r: any) => r.id),
    )
    .order("position");

  const byTeam = new Map<string, TeamDto["members"]>();
  for (const m of (members ?? []) as any[]) {
    const list = byTeam.get(m.registration_id) ?? [];
    list.push({
      studentId: m.student_id,
      fullName: m.students?.full_name ?? "",
      isReserve: m.is_reserve === true,
      position: Number(m.position) || 1,
    });
    byTeam.set(m.registration_id, list);
  }

  return (rows as any[]).map((r) => ({
    registrationId: r.id,
    name: r.team_name ?? "",
    clubId: r.club_id,
    clubName: r.clubs?.name ?? null,
    status: r.status,
    competitionNumber: r.competition_number != null ? String(r.competition_number) : null,
    members: byTeam.get(r.id) ?? [],
  }));
}

/**
 * Create a team, or replace the sheet of one that exists.
 *
 * Members are written as a set rather than added one at a time: a team sheet is
 * edited as a whole -- somebody drops out, a reserve moves up, the order
 * changes -- and applying that as a sequence of adds and removes is how a team
 * ends up with a competitor on it twice.
 */
export async function saveTeam(input: {
  eventId: string;
  categoryId: string;
  registrationId?: string;
  name: string;
  clubId: string;
  members: TeamMemberInput[];
}): Promise<{ ok: true; registrationId: string } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    const name = input.name.trim();
    if (!name) return { error: "Give the team a name." };
    if (!input.clubId) return { error: "A team competes for a club — choose one." };

    // A team of one is a person, and an empty team is nothing. Both are almost
    // always a half-finished form rather than an intention.
    const chosen = input.members.filter((m) => m.studentId);
    if (chosen.length < 2) return { error: "A team needs at least two members." };

    const unique = new Set(chosen.map((m) => m.studentId));
    if (unique.size !== chosen.length) return { error: "The same competitor is on this team twice." };

    const supabase = supabaseAdmin();

    let registrationId = input.registrationId ?? "";
    if (registrationId) {
      const { error } = await supabase
        .from("event_registrations")
        .update({ team_name: name, club_id: input.clubId })
        .eq("id", registrationId);
      if (error) return { error: `That team could not be saved: ${error.message}` };
    } else {
      const { data, error } = await supabase
        .from("event_registrations")
        .insert({
          event_id: input.eventId,
          category_id: input.categoryId,
          club_id: input.clubId,
          is_team: true,
          team_name: name,
          student_id: null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error || !data) return { error: `That team could not be entered: ${error?.message ?? "unknown error"}` };
      registrationId = data.id;
    }

    // Replace the sheet wholesale.
    await supabase.from("event_team_members").delete().eq("registration_id", registrationId);
    const { error: memberError } = await supabase.from("event_team_members").insert(
      chosen.map((m, i) => ({
        registration_id: registrationId,
        student_id: m.studentId,
        position: i + 1,
        is_reserve: m.isReserve,
      })),
    );
    if (memberError) return { error: `The team sheet could not be saved: ${memberError.message}` };

    revalidatePath(`/events/${input.eventId}`);
    return { ok: true, registrationId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That team could not be saved." };
  }
}

export async function deleteTeam(input: {
  eventId: string;
  registrationId: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    const supabase = supabaseAdmin();

    // A team already in a draw would leave the bracket pointing at nothing.
    const { data: inDraw } = await supabase
      .from("event_matches")
      .select("id")
      .or(
        `competitor1_registration_id.eq.${input.registrationId},competitor2_registration_id.eq.${input.registrationId}`,
      )
      .limit(1);
    if (inDraw && inDraw.length > 0) {
      return { error: "This team is in a draw already. Clear the draw first if it really has to go." };
    }

    // Members go with it by cascade.
    const { error } = await supabase.from("event_registrations").delete().eq("id", input.registrationId);
    if (error) return { error: "That team could not be removed." };

    revalidatePath(`/events/${input.eventId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That team could not be removed." };
  }
}

/** Confirm a team, the same way a competitor is confirmed. */
export async function setTeamStatus(input: {
  eventId: string;
  registrationId: string;
  status: "pending" | "confirmed";
}): Promise<{ ok: true } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    const { error } = await supabaseAdmin()
      .from("event_registrations")
      .update({ status: input.status })
      .eq("id", input.registrationId);
    if (error) return { error: "That could not be changed." };
    revalidatePath(`/events/${input.eventId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That could not be changed." };
  }
}
