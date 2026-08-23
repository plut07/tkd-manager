import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import ScoreboardTab from "../../ScoreboardTab";

export const dynamic = "force-dynamic";

/**
 * The scoreboard on its own address.
 *
 * The same panel that sits inside the event's Draw & Scoreboard tab, kept as a
 * page so it can be opened full-screen on the ring's own laptop while somebody
 * else works the draw.
 */
export default async function ScoreboardPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ring?: string };
}) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);

  const { data: event } = await supabaseAdmin().from("events").select("id, name").eq("id", params.id).maybeSingle();
  if (!event) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Scoreboard — {event.name}</h1>
          <p className="text-sm text-gray-500">Judges score on their own phones. Nothing reaches the draw until you confirm it.</p>
        </div>
        <Link href={`/events/${params.id}?tab=draws`} className="btn-secondary">Back to draw &amp; scoreboard</Link>
      </div>

      <ScoreboardTab
        eventId={params.id}
        ringId={searchParams.ring}
        hrefFor={(ring) => `/events/${params.id}/scoreboard?ring=${ring}`}
      />
    </div>
  );
}
