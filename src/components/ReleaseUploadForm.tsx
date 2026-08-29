"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/liveChannel";
import { RELEASE_BUCKET, formatBytes } from "@/lib/appReleases";
import { createUploadTarget, recordRelease } from "@/app/(app)/app-releases/actions";

/**
 * Putting a new build in front of the judges.
 *
 * The file goes from this browser straight to storage, not through the server:
 * Vercel refuses any request body over 4.5 MB and an APK is tens of megabytes,
 * so a normal form upload could never work however it was configured.
 *
 * The server decides whether this person may upload and writes down what
 * landed; the bytes take the short route in between.
 */
export default function ReleaseUploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !version.trim()) return;

    setBusy(true);
    setError("");
    setDone("");

    const client = browserClient();
    if (!client) {
      setBusy(false);
      setError("This site isn't configured to upload files from the browser. Ask for NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to be set.");
      return;
    }

    setStage("Asking permission…");
    const target = await createUploadTarget({ fileName: file.name, size: file.size });
    if ("error" in target) {
      setBusy(false);
      setStage("");
      setError(target.error);
      return;
    }

    setStage(`Uploading ${formatBytes(file.size)} — this takes a minute…`);
    const { error: uploadError } = await client.storage
      .from(RELEASE_BUCKET)
      .uploadToSignedUrl(target.path, target.token, file, {
        contentType: "application/vnd.android.package-archive",
      });
    if (uploadError) {
      setBusy(false);
      setStage("");
      setError(`The file didn't finish uploading: ${uploadError.message}`);
      return;
    }

    setStage("Publishing…");
    const saved = await recordRelease({
      path: target.path,
      fileName: file.name,
      size: file.size,
      version,
      notes,
    });
    setBusy(false);
    setStage("");
    if ("error" in saved) {
      setError(saved.error);
      return;
    }

    setDone(saved.message);
    setFile(null);
    setVersion("");
    setNotes("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label text-xs" htmlFor="release-file">The .apk file</label>
          <input
            id="release-file"
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            className="input !py-2 text-sm"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="mt-1 text-xs text-gray-400">
            {file ? `${file.name} · ${formatBytes(file.size)}` : "Downloaded from the Expo build page after eas build."}
          </p>
        </div>

        <div>
          <label className="label text-xs" htmlFor="release-version">Version</label>
          <input
            id="release-version"
            className="input"
            placeholder="1.0.0"
            value={version}
            disabled={busy}
            onChange={(e) => setVersion(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-400">Anything a judge can read out. It shows on the download page.</p>
        </div>
      </div>

      <div>
        <label className="label text-xs" htmlFor="release-notes">What changed (optional)</label>
        <input
          id="release-notes"
          className="input"
          placeholder="Presses now queue when the wifi drops."
          value={notes}
          disabled={busy}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700">{done}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy || !file || !version.trim()}>
          {busy ? "Working…" : "Publish this build"}
        </button>
        {stage && <span className="text-sm text-gray-500">{stage}</span>}
      </div>
    </form>
  );
}
