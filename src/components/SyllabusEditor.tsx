"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_SHEET, sheetMax, type ComponentKind, type SheetComponent } from "@/lib/gradingSheet";
import { saveSyllabus } from "@/app/(app)/events/examActions";

const KINDS: { value: ComponentKind; label: string; note: string }[] = [
  { value: "fixed", label: "Fixed columns", note: "Every content column is always marked." },
  { value: "select", label: "Chosen from a list", note: "The examiner picks what was performed and can add more." },
  { value: "breaking", label: "Techniques × attempts", note: "Chosen techniques, several attempts each." },
];

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `item_${Date.now()}`;
}

/**
 * The syllabus behind the marking sheet.
 *
 * Components, their contents and their marks, all editable — so a new pattern
 * or a change to the weightings doesn't need a developer. Saving applies it to
 * this event's Main Page immediately.
 *
 * The marks are shown adding up as you edit: a syllabus that doesn't come to
 * 100 is allowed, but you're told, because it silently changes what a pass
 * means.
 */
export default function SyllabusEditor({
  eventId,
  initialSheet,
  canEdit,
}: {
  eventId: string;
  initialSheet: SheetComponent[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<SheetComponent[]>(initialSheet);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const total = sheetMax(sheet);

  function update(index: number, patch: Partial<SheetComponent>) {
    setSheet((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
    setStatus("");
  }

  function move(index: number, by: number) {
    setSheet((prev) => {
      const next = [...prev];
      const target = index + by;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addComponent() {
    setSheet((prev) => [
      ...prev,
      { key: `component_${Date.now()}`, label: "New component", max: 0, itemMax: 10, kind: "fixed", items: [] },
    ]);
  }

  function addItem(index: number, label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    setSheet((prev) =>
      prev.map((c, i) => (i === index ? { ...c, items: [...c.items, { key: slug(trimmed), label: trimmed }] } : c)),
    );
  }

  async function save() {
    setBusy(true);
    setError("");
    setStatus("");
    const result = await saveSyllabus({ eventId, sheet });
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setStatus("Saved. The Main Page is now marking on this syllabus.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Exam syllabus</h2>
            <p className="mt-1 text-sm text-gray-500">
              What this event is marked on. Change a component, its contents or its marks, then save to apply it to the
              Main Page.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{total}</p>
            <p className={`text-xs ${total === 100 ? "text-gray-400" : "text-amber-700"}`}>
              {total === 100 ? "marks in total" : "marks in total — not 100"}
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => { void save(); }}>
              {busy ? "Saving..." : "Save syllabus"}
            </button>
            <button type="button" className="btn-secondary" onClick={addComponent}>Add component</button>
            <button
              type="button"
              className="text-sm font-medium text-gray-500 hover:underline"
              onClick={() => { setSheet(DEFAULT_SHEET); setStatus("Reset to the built-in syllabus — save to keep it."); }}
            >
              Reset to the built-in sheet
            </button>
            {status && <span className="text-sm text-green-700">{status}</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        )}
      </div>

      {sheet.map((component, index) => (
        <div key={component.key} className="card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grow">
              <label className="label text-xs">Component</label>
              <input
                type="text"
                className="input"
                value={component.label}
                disabled={!canEdit}
                onChange={(e) => update(index, { label: e.target.value })}
              />
            </div>
            <div>
              <label className="label text-xs">Marks</label>
              <input
                type="number"
                min={0}
                className="input !w-24 text-center"
                value={component.max}
                disabled={!canEdit}
                onChange={(e) => update(index, { max: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
            <div>
              <label className="label text-xs">Each row up to</label>
              <input
                type="number"
                min={1}
                className="input !w-24 text-center"
                value={component.itemMax}
                disabled={!canEdit}
                onChange={(e) => update(index, { itemMax: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
            <div>
              <label className="label text-xs">Marked as</label>
              <select
                className="input !w-52"
                value={component.kind}
                disabled={!canEdit}
                onChange={(e) => update(index, { kind: e.target.value as ComponentKind })}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2 pb-2 text-xs">
                <button type="button" className="text-gray-500 hover:underline" onClick={() => move(index, -1)}>↑</button>
                <button type="button" className="text-gray-500 hover:underline" onClick={() => move(index, 1)}>↓</button>
                <button
                  type="button"
                  className="font-medium text-red-600 hover:underline"
                  onClick={() => setSheet((prev) => prev.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          <p className="mt-1 text-xs text-gray-400">{KINDS.find((k) => k.value === component.kind)?.note}</p>

          {component.kind === "breaking" ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <div>
                <label className="label text-xs">Techniques</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  className="input !w-24 text-center"
                  value={component.methods ?? 3}
                  disabled={!canEdit}
                  onChange={(e) => update(index, { methods: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
              <div>
                <label className="label text-xs">Attempts each</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  className="input !w-24 text-center"
                  value={component.attempts ?? 3}
                  disabled={!canEdit}
                  onChange={(e) => update(index, { attempts: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
              <p className="w-full text-xs text-gray-400">
                Techniques are chosen from the standard list — Stationary, Flying and Jumping, hand and kick.
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <span className="label text-xs">
                {component.kind === "select" ? "Choices the examiner can pick from" : "Columns"}
              </span>
              <div className="mt-1 flex flex-wrap gap-2">
                {component.items.map((item, itemIndex) => (
                  <span key={item.key} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs">
                    {item.label}
                    {canEdit && (
                      <button
                        type="button"
                        className="text-red-600"
                        aria-label={`Remove ${item.label}`}
                        onClick={() =>
                          update(index, { items: component.items.filter((_, j) => j !== itemIndex) })
                        }
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {component.items.length === 0 && <span className="text-xs text-gray-400">Nothing yet.</span>}
              </div>
              {canEdit && (
                <AddItem onAdd={(label) => addItem(index, label)} />
              )}
              {component.kind === "select" && (
                <div className="mt-2">
                  <label className="label text-xs">Rows shown before adding more</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    className="input !w-24 text-center"
                    value={component.minRows ?? 2}
                    disabled={!canEdit}
                    onChange={(e) => update(index, { minRows: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {sheet.length === 0 && (
        <div className="card p-6 text-center text-sm text-gray-400">
          No components. Add one to start building the sheet.
        </div>
      )}
    </div>
  );
}

function AddItem({ onAdd }: { onAdd: (label: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        type="text"
        className="input max-w-xs !py-1 text-xs"
        placeholder="Add a pattern, round or column"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd(value);
            setValue("");
          }
        }}
      />
      <button
        type="button"
        className="btn-secondary !px-2 !py-1 text-xs"
        onClick={() => { onAdd(value); setValue(""); }}
      >
        Add
      </button>
    </div>
  );
}
