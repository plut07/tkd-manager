"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/liveChannel";
import { RELEASE_BUCKET, formatBytes } from "@/lib/appReleases";
import { createUploadTarget, recordRelease, recordLinkedRelease } from "@/app/(app)/app-releases/actions";

/**
 * Putting a new build in front of the judges. Two ways, because one of them
 * isn't always available.
 *
 * **A link.** The build stays where it was published — a GitHub Release, most
 * usefully — and this records the address. Nothing is copied, there is no size
 * limit worth worrying about, and it works on any deployment.
 *
 * **The file.** Uploaded from this browser straight to storage, never through
 * the server: Vercel refuses any request body over 4.5 MB and an APK is tens
 * of megabytes, so a normal form upload could never work however it was
 * configured. This needs the public Supabase keys set on the deployment, and
 * on the free plan storage stops at 50 MB per file — which a debug APK is
 * comfortably over.
 *
 * The link is offered first for that reason: it is the one that always works.
 */
export default function ReleaseUploadForm() {
  const router = useRouter();
  const [how, setHow] = useState<"link" | "file">("link");

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="flex gap-1 rounded-md bg-gray-100 p-1 sm:max-w-md">
        <Tab on={how === "link"} onClick={() => setHow("link")}>Link to a build</Tab>
        <Tab on={how === "file"} onClick={() => setHow("file")}>Upload the file</Tab>
      </div>

      {how === "link" ? <LinkForm onDone={() => router.refresh()} /> : <UploadForm onDone={() => router.refresh()} />}
    </div>
  );
}

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${on ? "bg-white text-brand-700 shadow-sm" : "text-gray-600"}`}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ by link

function LinkForm({ onDone }: { onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setDone("");
    const saved = await recordLinkedRelease({ url, version, notes });
    setBusy(false);
    if ("error" in saved) { setError(saved.error); return; }
    setDone(saved.message);
    setUrl("");
    setVersion("");
    setNotes("");
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <div>
        <label className="label text-xs" htmlFor="release-url">Address of the .apk file</label>
        <input
          id="release-url"
          className="input font-mono text-sm"
          placeholder="https://github.com/you/tkd-judge/releases/download/v1.0.0/tkd-judge.apk"
          value={url}
          disabled={busy}
          onChange={(e) => setUrl(e.target.value)}
        />
        <p className="mt-1 text-xs text-gray-400">
          The file itself, not the page it sits on. On GitHub: right-click the .apk under a release&apos;s
          <strong> Assets</strong> and copy the link address. Must be https.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label text-xs" htmlFor="release-link-version">Version</label>
          <input
            id="release-link-version"
            className="input"
            placeholder="1.0.0"
            value={version}
            disabled={busy}
            onChange={(e) => setVersion(e.target.value)}
          />
        </div>
        <div>
          <label className="label text-xs" htmlFor="release-link-notes">What changed (optional)</label>
          <input
            id="release-link-notes"
            className="input"
            placeholder="Presses now queue when the wifi drops."
            value={notes}
            disabled={busy}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700">{done}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy || !url.trim() || !version.trim()}>
          {busy ? "Working…" : "Publish this build"}
        </button>
        <span className="text-xs text-gray-400">
          The download page and its QR code keep the same address — judges never see where the file is kept.
        </span>
      </div>

      <details className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        <summary className="cursor-pointer font-medium text-gray-700">Where to put the APK — GitHub Releases</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Open your repository on GitHub and click <strong>Releases</strong> on the right, then <strong>Draft a new release</strong>.</li>
          <li>Give it a tag — <span className="font-mono">v1.0.0</span> — and a title.</li>
          <li>Drag the .apk into the <strong>Attach binaries</strong> box and wait for it to finish.</li>
          <li>Click <strong>Publish release</strong>.</li>
          <li>Right-click the .apk in the release&apos;s Assets list, copy the link address, and paste it above.</li>
        </ol>
        <p className="mt-2">
          A public repository is enough, and there is no practical size limit. A private one works too, but the link
          then only opens for people signed in to GitHub — which is no good for a judge at the door.
        </p>
      </details>
    </form>
  );
}

// ------------------------------------------------------------------ by file

function UploadForm({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  // Whether this deployment can upload at all. Checked when the tab opens
  // rather than when the button is pressed: being told after choosing a file
  // and typing a version is worse than being told before starting.
  const [canUpload, setCanUpload] = useState(true);

  useEffect(() => { setCanUpload(browserClient() != null); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !version.trim()) return;

    setBusy(true);
    setError("");
    setDone("");

    const client = browserClient();
    if (!client) {
      setBusy(false);
      setError(
        "This site isn't set up to upload files from the browser. Use “Link to a build” instead, or ask for " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to be set on the deployment.",
      );
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
      // The commonest failure by far, and the message storage gives for it
      // says nothing about the cause.
      const tooBig = /exceed|maximum|size/i.test(uploadError.message);
      setError(
        tooBig
          ? `Storage refused the file: ${uploadError.message}. The free plan stops at 50 MB per file. Either raise the ` +
            `limit in Supabase under Storage → Configuration, or publish it with “Link to a build” instead — that has no limit.`
          : `The file didn't finish uploading: ${uploadError.message}`,
      );
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
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      {!canUpload && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This deployment can&apos;t upload from the browser — NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY aren&apos;t set. Use <strong>Link to a build</strong> instead. (Setting them
          also makes the scoreboard update instantly rather than on a timer, so they are worth adding either way.)
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label text-xs" htmlFor="release-file">The .apk file</label>
          <input
            id="release-file"
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            className="input !py-2 text-sm"
            disabled={busy || !canUpload}
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
            disabled={busy || !canUpload}
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
          disabled={busy || !canUpload}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700">{done}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy || !canUpload || !file || !version.trim()}>
          {busy ? "Working…" : "Publish this build"}
        </button>
        {stage && <span className="text-sm text-gray-500">{stage}</span>}
      </div>
    </form>
  );
}
