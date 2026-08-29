import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { baseUrl } from "@/lib/urls";
import { formatBytes } from "@/lib/appReleases";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Where a referee gets the judge app.
 *
 * Written for somebody standing in a hall on a phone, five minutes before
 * their ring starts. No account, no explanation of what Expo is — the button,
 * then what Android is about to ask them, then how to get into their ring.
 *
 * The Android warning about installing outside the Play Store is stated up
 * front rather than left as a surprise: a judge who wasn't expecting it stops
 * and goes to find somebody, and there is nobody free at that moment.
 */
export default async function AppDownloadPage() {
  const { data: release } = await supabaseAdmin()
    .from("app_releases")
    .select("version, file_size, notes, uploaded_at")
    .eq("platform", "android")
    .eq("is_current", true)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const judgeWeb = `${baseUrl()}/public/judge`;
  const thisPage = `${baseUrl()}/public/app`;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="card p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">Scoreboard</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">Judge app</h1>
        <p className="mt-2 text-sm text-gray-600">
          Score your ring from your own phone. Your presses are saved on the phone first, so they are never lost if the
          hall wifi drops — they go out as soon as it comes back.
        </p>

        {release ? (
          <>
            <a
              href="/api/public/app-download"
              className="btn-primary mt-6 inline-block !px-8 !py-4 text-lg"
              download
            >
              Download for Android
            </a>

            {/* For the judge standing next to somebody who already has the
                page open — scanning is quicker than typing an address into a
                phone keyboard, and it can't be mistyped. */}
            <div className="mt-6 flex flex-col items-center">
              <img
                src={`/api/public/qr?url=${encodeURIComponent(thisPage)}&size=200`}
                alt={`QR code for ${thisPage}`}
                width={200}
                height={200}
                className="rounded-md border border-gray-200 bg-white p-2"
              />
              <p className="mt-2 text-xs text-gray-500">Scan to open this page on another phone</p>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Version {release.version} · {formatBytes(Number(release.file_size))} ·{" "}
              {new Date(release.uploaded_at).toLocaleDateString()}
            </p>
            {release.notes && <p className="mt-1 text-xs text-gray-500">{release.notes}</p>}
          </>
        ) : (
          <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            The app isn&apos;t ready to download yet. Use the web version below in the meantime — it does the same job.
          </p>
        )}
      </div>

      {release && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900">Installing it</h2>
          <ol className="mt-3 space-y-3 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">1</span>
              <span>Tap <strong>Download for Android</strong> above. Your phone saves a file ending in <span className="font-mono">.apk</span>.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">2</span>
              <span>Open it, from the notification or your Downloads folder.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">3</span>
              <span>
                Android will warn you that the app isn&apos;t from the Play Store. <strong>This is expected</strong> — the
                app isn&apos;t published there. Tap <strong>Settings</strong>, allow installs from your browser, then go
                back and tap <strong>Install</strong>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">4</span>
              <span>Open <strong>TKD Judge</strong>, type the scoreboard address and the 5-character join code the ring official gives you, then pick your judge number.</span>
            </li>
          </ol>

          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">The address to type in the app</p>
            <p className="mt-1 break-all font-mono text-base font-bold text-gray-900">{baseUrl().replace(/^https?:\/\//, "")}</p>
            <p className="mt-1 text-xs text-gray-500">You only type this the first time. The app remembers it.</p>
          </div>
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">No app? Use the web page</h2>
        <p className="mt-1 text-sm text-gray-600">
          The same judge screen works in a phone&apos;s browser with nothing to install. It has no offline queue, so a
          press made while the signal is down is refused rather than saved — on good wifi the two are identical.
        </p>
        <a href="/public/judge" className="btn-secondary mt-3 inline-block">Open the judge page</a>
        <p className="mt-2 break-all text-xs text-gray-400">{judgeWeb}</p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">iPhone and iPad</h2>
        <p className="mt-1 text-sm text-gray-600">
          There is no iPhone version yet — Apple doesn&apos;t allow an app to be installed from a link the way Android
          does. On an iPhone, use the web judge page above; it works the same.
        </p>
      </div>
    </div>
  );
}
