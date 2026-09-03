"use server";

import { revalidatePath } from "next/cache";
import { messageFrom, rethrowControlFlow } from "@/lib/controlFlow";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { parseTheme, DEFAULT_THEME, type ScoreboardTheme } from "@/lib/scoreboardTheme";

/**
 * The look of an event's scoreboard.
 *
 * Read through parseTheme on the way in as well as on the way out. What is
 * stored ends up in a style attribute on a page the hall is watching, so the
 * check belongs at the door rather than only at the point of use.
 */

export async function loadTheme(input: { eventId: string }): Promise<ScoreboardTheme> {
  const supabase = supabaseAdmin();

  const { data: own } = await supabase
    .from("scoreboard_themes")
    .select("settings")
    .eq("event_id", input.eventId)
    .maybeSingle();
  if (own) return parseTheme(own.settings);

  // Nothing set for this event, so the house style — and if there isn't one of
  // those either, the built-in look.
  const { data: house } = await supabase
    .from("scoreboard_themes")
    .select("settings")
    .is("event_id", null)
    .maybeSingle();
  return house ? parseTheme(house.settings) : DEFAULT_THEME;
}

export async function saveTheme(input: {
  eventId: string;
  theme: ScoreboardTheme;
}): Promise<{ ok: true; theme: ScoreboardTheme } | { error: string }> {
  try {
    const session = await requirePermission(PERMISSIONS.EVENT_EDIT);
    const clean = parseTheme(input.theme);

    const { error } = await supabaseAdmin()
      .from("scoreboard_themes")
      .upsert(
        {
          event_id: input.eventId,
          settings: clean,
          updated_at: new Date().toISOString(),
          updated_by: session.sub,
        },
        { onConflict: "event_id" },
      );
    if (error) return { error: `That look could not be saved: ${error.message}` };

    revalidatePath(`/events/${input.eventId}`);
    revalidatePath(`/events/${input.eventId}/scoreboard`);
    return { ok: true, theme: clean };
  } catch (e) {
    return { error: messageFrom(e, "That look could not be saved.") };
  }
}

/** Put this event back to the house style. */
export async function resetTheme(input: { eventId: string }): Promise<{ ok: true } | { error: string }> {
  try {
    await requirePermission(PERMISSIONS.EVENT_EDIT);
    await supabaseAdmin().from("scoreboard_themes").delete().eq("event_id", input.eventId);
    revalidatePath(`/events/${input.eventId}`);
    revalidatePath(`/events/${input.eventId}/scoreboard`);
    return { ok: true };
  } catch (e) {
    return { error: messageFrom(e, "That could not be reset.") };
  }
}
