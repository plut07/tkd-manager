import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { baseUrl } from "@/lib/urls";
import { loadRing } from "../../../scoreboardActions";

export const dynamic = "force-dynamic";

/**
 * The sheet that sits on the judges' table.
 *
 * One ring, one code, printed big. A judge arriving at the table scans it and
 * is in — the app reads both the scoreboard's address and the join code out of
 * it, and a judge without the app gets the web pad from their own camera.
 *
 * The code is printed in words underneath as well. A phone with a cracked lens
 * or a dead camera still has to be able to join.
 */
export default async function RingSheetPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ring?: string };
}) {
  await requirePermission(PERMISSIONS.EVENT_EDIT);

  const ring = searchParams.ring ? await loadRing({ ringId: searchParams.ring }) : null;
  if (!ring) notFound();

  const joinLink = `${baseUrl()}/public/judge?code=${ring.joinCode}`;
  const plainHost = baseUrl().replace(/^https?:\/\//, "");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-gray-500">Print one per ring and leave it where the judges sit.</p>
        <Link href={`/events/${params.id}?tab=draws&view=scoreboard&ring=${ring.id}`} className="btn-secondary">
          Back to the scoreboard
        </Link>
      </div>

      <div className="rounded-lg border border-gray-300 bg-white p-10 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">Judges — scan to join</p>
        <h1 className="mt-1 text-5xl font-black tracking-tight text-gray-900">{ring.name}</h1>
        {ring.categoryName && <p className="mt-1 text-xl text-gray-600">{ring.categoryName}</p>}

        <img
          src={`/api/public/qr?url=${encodeURIComponent(joinLink)}&size=420`}
          alt={`QR code to join ${ring.name}`}
          width={420}
          height={420}
          className="mx-auto mt-6"
        />

        <div className="mx-auto mt-4 max-w-md rounded-md border border-gray-300 bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Or type these</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{plainHost}</p>
          <p className="font-mono text-4xl font-black tracking-[0.3em] text-gray-900">{ring.joinCode}</p>
        </div>

        <ol className="mx-auto mt-6 max-w-md space-y-1 text-left text-base text-gray-800">
          <li><strong>1.</strong> Open <strong>TKD Judge</strong> and tap <strong>Scan the ring&apos;s QR code</strong>.</li>
          <li><strong>2.</strong> Point it at the code above.</li>
          <li><strong>3.</strong> Tap your judge number.</li>
        </ol>

        <p className="mt-6 text-sm text-gray-500">
          No app? Point your phone&apos;s ordinary camera at the same code — it opens the judge screen in your browser.
        </p>
      </div>
    </div>
  );
}
