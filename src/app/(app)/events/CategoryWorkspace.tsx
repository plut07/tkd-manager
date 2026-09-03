import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { measuredKindOf } from "@/lib/measured";
import { loadMeasured } from "./measuredActions";
import { loadTeams } from "./teamActions";
import MeasuredSheet from "@/components/MeasuredSheet";
import TeamsPanel, { type EligibleStudent } from "@/components/TeamsPanel";
import BracketView from "./BracketView";

/**
 * What a category needs, which depends on what kind of category it is.
 *
 * Three shapes of competition, and until now the app only had one of them:
 *
 *   fought      two competitors face each other — a draw and a bracket
 *   team        the same, but the competitor is a team that must be assembled
 *               first
 *   measured    nobody faces anybody: attempts are taken and counted, so there
 *               is no draw at all, only a score sheet and a table
 *
 * Picking between them here rather than in the page keeps the event page from
 * growing a third branch of its own, and means a category always opens on the
 * tool it actually needs.
 */

const TEAM_TYPES = new Set(["team_pattern", "team_sparring"]);

export default async function CategoryWorkspace({
  eventId,
  categoryId,
  canEdit,
  backHref,
}: {
  eventId: string;
  categoryId: string;
  canEdit: boolean;
  backHref: string;
}) {
  const supabase = supabaseAdmin();
  const { data: category } = await supabase
    .from("event_categories")
    .select("id, name, type")
    .eq("id", categoryId)
    .maybeSingle();

  if (!category) {
    return <div className="card p-8 text-center text-gray-500">That category no longer exists.</div>;
  }

  const type = (category as any).type as string | null;

  // Measured disciplines have no draw to show at all.
  if (measuredKindOf(type)) {
    const measured = await loadMeasured({ categoryId });
    if (!measured) {
      return <div className="card p-8 text-center text-gray-500">That category could not be loaded.</div>;
    }
    return <MeasuredSheet initial={measured} />;
  }

  // A team category is drawn exactly like any other — once there are teams to
  // draw. So the sheet sits above the bracket, in the order the work happens.
  if (TEAM_TYPES.has(type ?? "")) {
    const [teams, { data: studentRows }, { data: clubRows }] = await Promise.all([
      loadTeams({ categoryId }),
      supabase
        .from("students")
        .select("id, full_name, club_id, clubs(name)")
        .eq("active", true)
        .order("full_name"),
      supabase.from("clubs").select("id, name").order("name"),
    ]);

    const students: EligibleStudent[] = ((studentRows ?? []) as any[]).map((s) => ({
      id: s.id,
      fullName: s.full_name,
      clubId: s.club_id,
      clubName: s.clubs?.name ?? null,
    }));

    return (
      <div className="space-y-4">
        <TeamsPanel
          eventId={eventId}
          categoryId={categoryId}
          categoryName={(category as any).name}
          teams={teams}
          students={students}
          clubs={(clubRows ?? []) as { id: string; name: string }[]}
          canEdit={canEdit}
        />
        <BracketView
          eventId={eventId}
          categoryId={categoryId}
          canEdit={canEdit}
          backHref={backHref}
          backLabel="Back to draws list"
        />
      </div>
    );
  }

  return (
    <BracketView
      eventId={eventId}
      categoryId={categoryId}
      canEdit={canEdit}
      backHref={backHref}
      backLabel="Back to draws list"
    />
  );
}
