"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_SHEET as SHEET, componentsFor, SHEET_TOTAL_MAX } from "@/lib/gradingSheet";
import { setCategoryEvents } from "@/app/(app)/events/examActions";

/**
 * Which events a grading category is marked on.
 *
 * Junior grades don't sit power breaking, so their categories carry a shorter
 * list. Each part keeps its own share of the 100 marks, so leaving one out
 * lowers the highest mark a candidate in that category can reach.
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
  const [chosen, setChosen] = useState<string[]>(() => componentsFor(examEvents).map((c) => c.key));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const marksInPlay = SHEET.filter((c) => chosen.includes(c.key)).reduce((n, c) => n + c.max, 0);

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
    return <span className="text-xs text-gray-400">{componentsFor(examEvents).length} parts</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-xs font-medium text-brand-700 hover:underline"
        onClick={() => setOpen(true)}
        title={`Choose which parts of the sheet ${categoryName} is marked on`}
      >
        {componentsFor(examEvents).length} parts
      </button>
    );
  }

  return (
    <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
      <p className="text-xs font-semibold text-gray-900">{categoryName} is marked on</p>
      <div className="mt-2 space-y-1">
        {SHEET.map((c) => (
          <label key={c.key} className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" className="h-4 w-4" checked={chosen.includes(c.key)} onChange={() => toggle(c.key)} />
            {c.label}
            <span className="ml-auto text-gray-400">{c.max}</span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {chosen.length} part{chosen.length === 1 ? "" : "s"} · {marksInPlay} of the {SHEET_TOTAL_MAX} marks
        {marksInPlay !== SHEET_TOTAL_MAX && <span className="text-amber-700"> — candidates can&apos;t reach 100</span>}
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
