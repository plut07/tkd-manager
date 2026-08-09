"use client";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import type { PreviewState, CommitState } from "@/app/(app)/importActions";

function Submit({ label, busy, className = "btn-primary" }: { label: string; busy: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}

/**
 * Upload -> check -> confirm. Nothing is written until the confirm step, and
 * rows that match an existing record are only updated if the box is ticked —
 * otherwise they're reported as "already exists" and left alone.
 */
export default function ImportWizard({
  kind,
  preview,
  commit,
  backHref,
  backLabel,
}: {
  kind: "students" | "clubs";
  preview: (prev: PreviewState, formData: FormData) => Promise<PreviewState>;
  commit: (prev: CommitState, formData: FormData) => Promise<CommitState>;
  backHref: string;
  backLabel: string;
}) {
  const [previewState, previewAction] = useFormState<PreviewState, FormData>(preview, undefined);
  const [commitState, commitAction] = useFormState<CommitState, FormData>(commit, undefined);

  const noun = kind === "clubs" ? "clubs" : "students";

  if (commitState?.ok) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-green-700">Import finished</h2>
        <ul className="mt-3 space-y-1 text-sm text-gray-700">
          <li>{commitState.created} new {noun} added</li>
          <li>{commitState.updated} existing {noun} updated</li>
          {commitState.skipped > 0 && <li>{commitState.skipped} left unchanged because they already existed</li>}
        </ul>
        <Link href={backHref} className="btn-primary mt-4 inline-flex">{backLabel}</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">1. Start from the template</h2>
        <p className="mt-1 text-sm text-gray-500">
          The importer matches columns by their heading, so keep the header row exactly as it comes. The second and third
          rows of the template are an example and some notes — delete both before uploading.
        </p>
        <a href={`/api/export/template?kind=${kind}`} className="btn-secondary mt-3 inline-flex">Download template</a>
      </div>

      <form action={previewAction} className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-gray-900">2. Upload your file</h2>
        <input type="file" name="file" accept=".xlsx,.xls,.csv" required className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700" />
        <p className="text-xs text-gray-400">Nothing is saved yet — you&apos;ll see exactly what will change before anything is written.</p>
        {previewState?.ok === false && <p className="text-sm text-red-600">{previewState.error}</p>}
        <Submit label="Check file" busy="Checking..." className="btn-secondary" />
      </form>

      {previewState?.ok && (
        <>
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900">3. Check what will happen</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-green-200 bg-green-50 p-3">
                <div className="text-2xl font-bold text-green-700">{previewState.create.length}</div>
                <div className="text-sm text-green-800">will be added</div>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <div className="text-2xl font-bold text-amber-700">{previewState.update.length}</div>
                <div className="text-sm text-amber-800">already exist</div>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <div className="text-2xl font-bold text-red-700">{previewState.errors.length}</div>
                <div className="text-sm text-red-800">problems found</div>
              </div>
            </div>
          </div>

          {previewState.errors.length > 0 && (
            <div className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-900">Rows with problems</h3>
                <form action="/api/export/import-errors" method="post">
                  <input type="hidden" name="errors" value={JSON.stringify(previewState.errors)} />
                  <button type="submit" className="btn-secondary !px-3 !py-1.5 text-xs">Download as spreadsheet</button>
                </form>
              </div>
              <p className="mt-1 text-sm text-gray-500">These rows will be skipped. Row numbers match your spreadsheet.</p>
              <div className="mt-3 max-h-80 overflow-auto overflow-x-auto">
                <table className="table-base">
                  <thead><tr><th>Row</th><th>Column</th><th>Value</th><th>Problem</th></tr></thead>
                  <tbody>
                    {previewState.errors.slice(0, 200).map((e, i) => (
                      <tr key={i}>
                        <td className="font-medium text-gray-900">{e.row}</td>
                        <td>{e.column}</td>
                        <td className="text-gray-500">{e.value || <span className="text-gray-300">blank</span>}</td>
                        <td className="text-red-700">{e.problem}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewState.errors.length > 200 && (
                  <p className="py-2 text-center text-xs text-gray-400">Showing the first 200 — download the spreadsheet for the rest.</p>
                )}
              </div>
            </div>
          )}

          {previewState.update.length > 0 && (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900">Already in the system ({previewState.update.length})</h3>
              <p className="mt-1 text-sm text-gray-500">
                These match {kind === "clubs" ? "a club name" : "an ID number"} that already exists. Leave the box below
                unticked and they&apos;ll be left exactly as they are.
              </p>
              <ul className="mt-3 max-h-52 space-y-1 overflow-auto text-sm text-gray-700">
                {previewState.update.slice(0, 100).map((r) => (
                  <li key={r.row}>Row {r.row}: {r.label}</li>
                ))}
              </ul>
            </div>
          )}

          <form action={commitAction} className="card space-y-3 p-6">
            <h2 className="text-lg font-semibold text-gray-900">4. Confirm</h2>
            <input type="hidden" name="payload" value={previewState.payload} />
            {previewState.update.length > 0 && (
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" name="applyUpdates" className="mt-0.5" />
                <span>
                  Yes, update the {previewState.update.length} existing {noun} with the values from my file.
                  <span className="block text-xs text-gray-500">Leave unticked to add only the new ones and report the rest as already existing.</span>
                </span>
              </label>
            )}
            {commitState?.ok === false && <p className="text-sm text-red-600">{commitState.error}</p>}
            <div className="flex flex-wrap gap-2">
              <Submit label={`Import ${previewState.create.length} new ${noun}`} busy="Importing..." />
              <Link href={backHref} className="btn-secondary">Cancel</Link>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
