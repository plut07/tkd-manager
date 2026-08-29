import Link from "next/link";
import { requireSuperAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { baseUrl } from "@/lib/urls";
import { formatBytes } from "@/lib/appReleases";
import ReleaseUploadForm from "@/components/ReleaseUploadForm";
import DeleteButton from "@/components/DeleteButton";
import { makeCurrent, deleteRelease } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Publishing the judge app.
 *
 * Super Admin only. This is the one page that hands a file to somebody's phone
 * and asks them to install it, which is not a thing to give away with ordinary
 * event permissions.
 */
export default async function AppReleasesPage() {
  await requireSuperAdmin();

  const { data: releases } = await supabaseAdmin()
    .from("app_releases")
    .select("*")
    .eq("platform", "android")
    .order("uploaded_at", { ascending: false });

  const current = (releases ?? []).find((r: any) => r.is_current) ?? null;
  const downloadPage = `${baseUrl()}/public/app`;

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Judge app</h1>
            <p className="mt-1 text-sm text-gray-500">
              The Android app referees install to score on their own phones. Upload a build here and it becomes the
              download on the public page.
            </p>
          </div>
          <Link href="/public/app" target="_blank" className="btn-secondary">Open the download page</Link>
        </div>

        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Send judges here</p>
          <p className="mt-1 break-all font-mono text-base font-bold text-gray-900">{downloadPage}</p>
          <p className="mt-1 text-xs text-gray-500">
            Works on any phone. Nobody needs an account to reach it — the page only offers the file, and the app still
            needs a join code before it can score.
          </p>
        </div>

        {current ? (
          <p className="mt-3 text-sm text-gray-600">
            Judges are currently offered <strong>version {current.version}</strong> ({formatBytes(Number(current.file_size))}
            ), uploaded {new Date(current.uploaded_at).toLocaleDateString()}.
          </p>
        ) : (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Nothing has been uploaded yet, so the download page tells visitors the app isn&apos;t ready. Build the APK
            with <span className="font-mono">eas build --platform android --profile apk</span>, download it from Expo,
            then upload it below.
          </p>
        )}

        <ReleaseUploadForm />

        <p className="mt-3 text-xs text-gray-400">
          The file goes from your browser straight to storage rather than through this server — Vercel refuses any
          upload over 4.5 MB, and an APK is far bigger. If it ever fails here, the file can be put into the
          <span className="font-mono"> app-releases </span> bucket from the Supabase dashboard instead, and this page
          will offer it once a row is added.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">Builds ({(releases ?? []).length})</h2>
        <p className="mt-1 text-sm text-gray-500">
          Older builds are kept. If a new one turns out to be broken mid-event, put the previous one back rather than
          rebuilding under pressure.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Version</th><th>Uploaded</th><th>Size</th><th>Notes</th><th></th><th></th></tr>
            </thead>
            <tbody>
              {(releases ?? []).map((r: any) => (
                <tr key={r.id}>
                  <td className="font-medium text-gray-900">
                    {r.version}
                    {r.is_current && <span className="ml-2 badge bg-green-100 text-green-700">Offered now</span>}
                  </td>
                  <td>{new Date(r.uploaded_at).toLocaleString()}</td>
                  <td>{formatBytes(Number(r.file_size))}</td>
                  <td className="text-gray-600">{r.notes ?? "—"}</td>
                  <td className="text-right">
                    {!r.is_current && (
                      <form action={makeCurrent}>
                        <input type="hidden" name="releaseId" value={r.id} />
                        <input type="hidden" name="platform" value="android" />
                        <button type="submit" className="text-sm font-medium text-brand-700 hover:underline">Offer this one</button>
                      </form>
                    )}
                  </td>
                  <td className="text-right">
                    <DeleteButton
                      action={deleteRelease}
                      fieldName="releaseId"
                      fieldValue={r.id}
                      confirmLabel={`Delete version ${r.version}? Anyone who already installed it keeps it, but it can't be downloaded again.`}
                      label="Delete"
                    />
                  </td>
                </tr>
              ))}
              {(releases ?? []).length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-gray-400">No builds uploaded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
