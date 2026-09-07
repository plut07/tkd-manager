import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import MeasuredStandings from "@/components/MeasuredStandings";
import { loadPublicStandings } from "@/app/(app)/events/measuredActions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * A measured division's standings, for anybody with the link.
 *
 * The counterpart to a published bracket: a fought division could always be
 * followed from outside while it happened, and a power test could not. Shown
 * only once the organiser has opened this category up, so a division still
 * being scored stays private — see setStandingsPublic.
 */
export default async function PublicStandingsPage({
  params,
}: {
  params: { id: string; categoryId: string };
}) {
  const data = await loadPublicStandings({ categoryId: params.categoryId });
  if (!data || data.eventId !== params.id) notFound();

  const { data: event } = await supabaseAdmin()
    .from("events")
    .select("name")
    .eq("id", params.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{data.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {event?.name} · {data.kind === "power_test" ? "Power test" : "Special technique"}
            </p>
          </div>
          <Link href={`/public/events/${params.id}`} className="btn-secondary">
            Back to event
          </Link>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-900">Standings</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Updates as attempts are recorded. Nothing here is final until the event&apos;s results are published.
        </p>
        <div className="mt-3">
          <MeasuredStandings data={data} />
        </div>
      </div>
    </div>
  );
}
