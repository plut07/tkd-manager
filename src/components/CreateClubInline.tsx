"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClubForCandidate } from "@/app/(app)/events/gradingActions";

/**
 * The club a registrant typed that we've never heard of.
 *
 * Approving them into the wrong club to get past this would be worse than
 * stopping, so the entry is held and the club offered for creation right here,
 * with the name they gave already filled in.
 */
export default function CreateClubInline({
  candidateId,
  eventId,
  suggestedName,
}: {
  candidateId: string;
  eventId: string;
  suggestedName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestedName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    const result = await createClubForCandidate({ candidateId, eventId, name });
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="text-xs font-medium text-amber-800">
        {suggestedName
          ? `"${suggestedName}" isn't a club on file yet. Create it, or pick an existing club, before approving.`
          : "No club was given. Pick one from the list, or create the right one, before approving."}
      </p>

      {open ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            className="input !w-56 !py-1 text-xs"
            value={name}
            placeholder="Club name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void create(); } }}
          />
          <button type="button" className="btn-primary !px-2 !py-1 text-xs" disabled={busy || !name.trim()} onClick={() => { void create(); }}>
            {busy ? "Creating..." : "Create club"}
          </button>
          <button type="button" className="text-xs font-medium text-gray-500 hover:underline" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="mt-1 text-xs font-medium text-brand-700 hover:underline" onClick={() => setOpen(true)}>
          Create this club
        </button>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
