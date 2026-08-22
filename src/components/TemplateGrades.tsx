"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GRADE_OPTIONS } from "@/lib/belts";
import { setTemplateGrades } from "@/app/(app)/events/templateActions";

/**
 * Which grades a result form covers.
 *
 * An event usually has a few different forms — one for colour belts, another
 * for Dan grades — so each says which ranks it is for. Nothing ticked means it
 * covers any rank, which is what a single general form does.
 */
export default function TemplateGrades({
  templateId,
  eventId,
  grades,
  canEdit,
}: {
  templateId: string;
  eventId: string;
  grades: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>(grades);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Every grade except the first can be graded *to*.
  const options = GRADE_OPTIONS.slice(1);
  const summary =
    chosen.length === 0
      ? "Any grade"
      : chosen.length <= 3
        ? options.filter((g) => chosen.includes(g.value)).map((g) => g.label).join(", ")
        : `${chosen.length} grades`;

  function toggle(value: string) {
    setChosen((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function save() {
    setBusy(true);
    setError("");
    const result = await setTemplateGrades({ templateId, eventId, grades: chosen });
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!canEdit) return <span className="text-xs text-gray-400">{summary}</span>;

  if (!open) {
    return (
      <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setOpen(true)}>
        For: {summary}
      </button>
    );
  }

  return (
    <div className="absolute right-0 z-20 mt-1 w-72 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
      <p className="text-xs font-semibold text-gray-900">This form is for</p>
      <p className="mt-0.5 text-xs text-gray-500">Tick nothing to use it for any grade.</p>

      <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
        {options.map((g) => (
          <label key={g.value} className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" className="h-4 w-4" checked={chosen.includes(g.value)} onChange={() => toggle(g.value)} />
            Grading to {g.label}
          </label>
        ))}
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary !px-2 !py-1 text-xs" disabled={busy} onClick={() => { void save(); }}>
          {busy ? "Saving..." : "Save"}
        </button>
        <button type="button" className="text-xs font-medium text-gray-500 hover:underline" onClick={() => setChosen([])}>
          Clear
        </button>
        <button type="button" className="text-xs font-medium text-gray-500 hover:underline" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
