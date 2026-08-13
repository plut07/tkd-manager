"use client";

import { useState, useTransition } from "react";
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
 * The row's own "editing" state isn't reset by a server action, so the save is
 * wrapped in a transition that closes the editor and refreshes the page itself.
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
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const current = GRADE_OPTIONS.find((g) => g.label === categoryName)?.value ?? "";

  function save(formData: FormData) {
    startTransition(async () => {
      await updateRegistrationCategory(formData);
      setEditing(false);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    });
  }

  if (!canEdit) return <span>{categoryName ?? "—"}</span>;

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span>{categoryName ?? <span className="text-amber-600">Not set</span>}</span>
        <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setEditing(true)}>
          Edit
        </button>
        {saved && <span className="text-xs text-green-600">Saved</span>}
      </span>
    );
  }

  return (
    <form action={save} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="registrationId" value={registrationId} />
      <input type="hidden" name="eventId" value={eventId} />
      <select name="targetGrade" defaultValue={current} className="input !w-44 !px-2 !py-1 text-xs">
        <option value="">No category</option>
        {GRADE_OPTIONS.map((g) => (
          <option key={g.value} value={g.value}>{g.label}</option>
        ))}
      </select>
      <button type="submit" className="btn-primary !px-2 !py-1 text-xs" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </button>
      <button type="button" className="text-xs font-medium text-gray-500 hover:underline" onClick={() => setEditing(false)}>
        Cancel
      </button>
    </form>
  );
}
