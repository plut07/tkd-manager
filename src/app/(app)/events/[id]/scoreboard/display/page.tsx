import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ScoreboardDisplay from "@/components/ScoreboardDisplay";
import { loadRing } from "../../../scoreboardActions";

export const dynamic = "force-dynamic";

/**
 * The projector screen. Meant to be opened full-screen on a second monitor and
 * then left alone.
 */
export default async function ScoreboardDisplayPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ring?: string };
}) {
  await requirePermission(PERMISSIONS.EVENT_VIEW);

  let ringId = searchParams.ring ?? null;
  if (!ringId) {
    const { data } = await supabaseAdmin()
      .from("scoreboard_rings")
      .select("id")
      .eq("event_id", params.id)
      .order("created_at")
      .limit(1);
    ringId = data?.[0]?.id ?? null;
  }

  const ring = ringId ? await loadRing({ ringId }) : null;
  if (!ring) notFound();

  return <ScoreboardDisplay initial={ring} />;
}
