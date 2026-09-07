import { supabaseAdmin } from "@/lib/supabaseAdmin";
import OfficialsPanel, { type RingLite, type StudentLite } from "@/components/OfficialsPanel";
import { loadOfficials } from "./officialsActions";

/** The umpire panel for one event, and where everybody is sitting. */
export default async function OfficialsTab({ eventId, canEdit }: { eventId: string; canEdit: boolean }) {
  const supabase = supabaseAdmin();

  const [officials, { data: ringRows }, { data: studentRows }, { data: clubRows }] = await Promise.all([
    loadOfficials(eventId),
    supabase.from("scoreboard_rings").select("id, name, judge_count").eq("event_id", eventId).order("created_at"),
    supabase.from("students").select("id, full_name, club_id").eq("active", true).order("full_name"),
    supabase.from("clubs").select("id, name").order("name"),
  ]);

  const rings: RingLite[] = ((ringRows ?? []) as any[]).map((r) => ({
    id: r.id,
    name: r.name,
    judgeCount: Number(r.judge_count) || 5,
  }));

  const students: StudentLite[] = ((studentRows ?? []) as any[]).map((s) => ({
    id: s.id,
    fullName: s.full_name,
    clubId: s.club_id,
  }));

  return (
    <OfficialsPanel
      eventId={eventId}
      officials={officials}
      rings={rings}
      students={students}
      clubs={(clubRows ?? []) as { id: string; name: string }[]}
      canEdit={canEdit}
    />
  );
}
