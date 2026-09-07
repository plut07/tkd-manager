"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { canOverrideLocks } from "@/lib/eventStatus";

/**
 * Publishing a competition's results.
 *
 * Deliberately separate from the grading one, which shares the same column but
 * not the same meaning: publishing a grading also promotes everybody who
 * passed, and a competition must never do that. Two actions on one flag is the
 * honest arrangement — a shared function with a "don't promote" argument would
 * be one wrong call away from re-grading a hall full of people.
 *
 * Until this is pressed the public page shows the event but not its results,
 * so a half-finished day is never mistaken for a final list.
 */

async function assertCanPublish(eventId: string) {
  const session = await requireSession();
  const supabase = supabaseAdmin();
  const { data: event } = await supabase.from("events").select("id, created_by, event_type").eq("id", eventId).maybeSingle();
  if (!event) throw new Error("Event not found.");
  if ((event as any).event_type !== "competition") {
    throw new Error("This is not a competition — publish it from its own Results tab.");
  }
  if (!canOverrideLocks({ sub: session.sub, role: session.role }, event as any)) {
    throw new Error("Only a Super Admin or the person who created this event can publish its results.");
  }
  return { session, supabase };
}

export async function publishCompetitionResults(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) return;
  const { session, supabase } = await assertCanPublish(eventId);
  await supabase
    .from("events")
    .update({ results_published_at: new Date().toISOString(), results_published_by: session.sub })
    .eq("id", eventId);
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/public/events/${eventId}`);
}

export async function unpublishCompetitionResults(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  if (!eventId) return;
  const { supabase } = await assertCanPublish(eventId);
  await supabase.from("events").update({ results_published_at: null, results_published_by: null }).eq("id", eventId);
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/public/events/${eventId}`);
}
