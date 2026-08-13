"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GRADE_OPTIONS } from "@/lib/belts";
import { updateRegistrationCategory } from "@/app/(app)/events/actions";

/**
 * A grading candidate's category, editable in place.
 *
 * The list offers every grade on the ladder rather than only the categories
 * that already exist, so an examiner can move somebody into a grade nobody has
 * registered for yet — it gets created on save.
 *
 * The save result is read and shown rather than assumed. An earlier version
 * fired the action and refreshed regardless, which meant a rejected write
 * looked exactly like a successful one that changed nothing.
 */
export default function CategoryCell({
  registrationId,
  eventId,
  categoryName,
  canEdit,
}: {
  registrationId: string;
  eventId: string;
  categoryName: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState(() => GRADE_OPTIONS.find((g) => g.label === categoryName)?.value ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError("");
    const result = await updateRegistrationCategory({ registrationId, eventId, targetGrade: choice });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 3000);
  }

  if (!canEdit) return <span>{categoryName ?? "—"}</span>;

  if (!editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span>{categoryName ?? <span className="text-amber-600">Not set</span>}</span>
        <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setEditing(true)}>
          Edit
        </button>
        {saved && <span className="text-xs text-green-600">Saved</span>}
        {error && <span className="w-full text-xs text-red-600">{error}</span>}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <select
        className="input !w-44 !px-2 !py-1 text-xs"
        value={choice}
        disabled={busy}
        onChange={(e) => setChoice(e.target.value)}
      >
        <option value="">No category</option>
        {GRADE_OPTIONS.map((g) => (
          <option key={g.value} value={g.value}>{g.label}</option>
        ))}
      </select>
      <button type="button" className="btn-primary !px-2 !py-1 text-xs" disabled={busy} onClick={() => { void save(); }}>
        {busy ? "Saving..." : "Save"}
      </button>
      <button
        type="button"
        className="text-xs font-medium text-gray-500 hover:underline"
        disabled={busy}
        onClick={() => { setEditing(false); setError(""); }}
      >
        Cancel
      </button>
      {error && <span className="w-full text-xs text-red-600">{error}</span>}
    </div>
  );
}
