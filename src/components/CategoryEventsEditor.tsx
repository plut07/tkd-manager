"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EXAM_EVENTS, eventsFor, SCORE_MAX, TOTAL_MAX } from "@/lib/gradingExam";
import { setCategoryEvents } from "@/app/(app)/events/examActions";

/**
 * Which events a grading category is marked on.
 *
 * Junior grades don't sit breaking or knife work, so their categories carry a
 * shorter list. Whatever is ticked, the total is still presented out of 100 —
 * four events are worth 2.5 points each, eight are worth 1.25 — so a mark means
 * the same thing wherever it came from.
 */
export default function CategoryEventsEditor({
  eventId,
  categoryId,
  categoryName,
  examEvents,
  canEdit,
}: {
  eventId: string;
  categoryId: string;
  categoryName: string;
  examEvents: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>(() => eventsFor(examEvents).map((e) => e.key));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const perEvent = chosen.length > 0 ? Math.round((TOTAL_MAX / (chosen.length * SCORE_MAX)) * 100) / 100 : 0;

  function toggle(key: string) {
    setChosen((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function save() {
    setBusy(true);
    setError("");
    const result = await setCategoryEvents({ eventId, categoryId, eventKeys: chosen });
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!canEdit) {
    return <span className="text-xs text-gray-400">{eventsFor(examEvents).length} events</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-xs font-medium text-brand-700 hover:underline"
        onClick={() => setOpen(true)}
        title={`Choose which events ${categoryName} is marked on`}
      >
        {eventsFor(examEvents).length} events
      </button>
    );
  }

  return (
    <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
      <p className="text-xs font-semibold text-gray-900">{categoryName} is marked on</p>
      <div className="mt-2 space-y-1">
        {EXAM_EVENTS.map((e) => (
          <label key={e.key} className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" className="h-4 w-4" checked={chosen.includes(e.key)} onChange={() => toggle(e.key)} />
            {e.label}
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {chosen.length} event{chosen.length === 1 ? "" : "s"} · each point worth {perEvent} · total out of {TOTAL_MAX}
      </p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" className="btn-primary !px-2 !py-1 text-xs" disabled={busy} onClick={() => { void save(); }}>
          {busy ? "Saving..." : "Save"}
        </button>
        <button type="button" className="text-xs font-medium text-gray-500 hover:underline" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
