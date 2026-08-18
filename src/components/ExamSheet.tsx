"use client";

import { useState } from "react";
import {
  BREAKING_ATTEMPTS,
  componentTotal,
  componentsFor,
  itemLabel,
  markValue,
  selectedRows,
  sheetTotal,
  marksSayPassed,
  sheetMax,
  PASS_MARK,
  REMARK_MAX,
  type SheetComponent,
  type SheetMarks,
  type SelectedRow,
} from "@/lib/gradingSheet";
import { breakingGroups } from "@/lib/powerBreaking";
import { loadMySignature } from "@/app/(app)/events/examActions";

export type SheetDraft = {
  marks: SheetMarks;
  remark: string;
  /** Undefined means "follow the mark"; set only when overridden by hand. */
  passed?: boolean;
  approvedRank: string;
  examinerSignature: string | null;
};

/**
 * One candidate's marking sheet, laid out like the paper form.
 *
 * Components down the left, their contents in the middle, Max and Alloted on
 * the right. Alloted adds the rows up and stops at the component's Max.
 *
 * Pattern and Step-Sparring aren't fixed columns: the examiner picks what was
 * actually performed, and a spare row is always waiting at the bottom for one
 * more. Power breaking works the same way, from the technique list.
 */
export default function ExamSheet({
  studentName,
  clubName,
  currentGrade,
  categoryName,
  sheet,
  components,
  draft,
  locked,
  canMark,
  examinerName,
  onChange,
}: {
  studentName: string;
  clubName: string | null;
  currentGrade: string;
  categoryName: string | null;
  sheet: SheetComponent[];
  components: string[];
  draft: SheetDraft;
  locked: boolean;
  canMark: boolean;
  examinerName: string;
  onChange: (patch: Partial<SheetDraft>) => void;
}) {
  const inPlay = componentsFor(components, sheet);
  const inPlayKeys = new Set(inPlay.map((c) => c.key));
  const total = sheetTotal(draft.marks, inPlay);
  const autoPass = marksSayPassed(draft.marks, inPlay);
  // The tick follows the mark until somebody deliberately sets it otherwise.
  const passed = draft.passed ?? autoPass;
  const overridden = draft.passed != null && draft.passed !== autoPass;
  const disabled = !canMark || locked;
  const max = sheetMax(inPlay);

  function setMark(key: string, value: string, itemMax: number) {
    const next = { ...draft.marks };
    if (value === "") delete next[key];
    else next[key] = Math.min(Math.max(Number(value) || 0, 0), itemMax);
    onChange({ marks: next });
  }

  function setChoice(key: string, value: string) {
    const next = { ...draft.marks };
    if (!value) delete next[key];
    else next[key] = value;
    onChange({ marks: next });
  }

  function setRows(component: SheetComponent, rows: SelectedRow[]) {
    onChange({ marks: { ...draft.marks, [`${component.key}__rows`]: rows } });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 pb-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{studentName}</h3>
          <p className="text-xs text-gray-500">
            {clubName ?? "No club"} · currently {currentGrade}
            {categoryName ? ` · grading for ${categoryName}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">
            {total}
            <span className="text-sm font-normal text-gray-400"> / {max}</span>
          </p>
          <span className={`badge ${passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {passed ? "PASSED" : "FAILED"}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="w-48 border border-gray-300 px-2 py-1 text-left">Components</th>
              <th className="border border-gray-300 px-2 py-1 text-left">Content</th>
              <th className="w-16 border border-gray-300 px-2 py-1 text-center">Max</th>
              <th className="w-20 border border-gray-300 px-2 py-1 text-center">Alloted</th>
            </tr>
          </thead>
          <tbody>
            {sheet.map((component) => {
              const active = inPlayKeys.has(component.key);
              return (
                <tr key={component.key} className={active ? undefined : "opacity-40"}>
                  <td className="border border-gray-300 px-2 py-2 align-top font-semibold text-gray-800">
                    {component.label}
                    {!active && <span className="block text-xs font-normal text-gray-400">not sat</span>}
                  </td>
                  <td className="border border-gray-300 px-2 py-2">
                    {!active ? (
                      <span className="text-xs text-gray-400">Not part of this category&apos;s exam.</span>
                    ) : component.kind === "select" ? (
                      <SelectRows
                        component={component}
                        rows={selectedRows(draft.marks, component)}
                        disabled={disabled}
                        onChange={(rows) => setRows(component, rows)}
                      />
                    ) : component.kind === "breaking" ? (
                      <BreakingRows
                        component={component}
                        marks={draft.marks}
                        disabled={disabled}
                        onScore={(key, value) => setMark(key, value, component.itemMax)}
                        onMethod={setChoice}
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {component.items.map((item) => (
                          <label key={item.key} className="text-xs text-gray-600">
                            <span className="block whitespace-nowrap">{item.label}</span>
                            <input
                              type="number"
                              min={0}
                              max={component.itemMax}
                              step="0.5"
                              className="input !w-20 !px-1 !py-1 text-center"
                              value={markValue(draft.marks, item.key) ?? ""}
                              disabled={disabled}
                              placeholder={`0-${component.itemMax}`}
                              onChange={(e) => setMark(item.key, e.target.value, component.itemMax)}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center font-semibold text-gray-700">{component.max}</td>
                  <td className="border border-gray-300 px-2 py-2 text-center font-semibold text-gray-900">
                    {active ? componentTotal(component, draft.marks) : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-2 py-1 text-right font-semibold" colSpan={2}>Total</td>
              <td className="border border-gray-300 px-2 py-1 text-center font-semibold">{max}</td>
              <td className="border border-gray-300 px-2 py-1 text-center text-lg font-bold text-gray-900">{total}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <label className="label text-xs" htmlFor={`remark-${studentName}`}>Remarks</label>
          <textarea
            id={`remark-${studentName}`}
            className="input min-h-[5rem]"
            maxLength={REMARK_MAX}
            value={draft.remark}
            disabled={disabled}
            onChange={(e) => onChange({ remark: e.target.value.slice(0, REMARK_MAX) })}
          />
          <p className="mt-1 text-xs text-gray-400">{draft.remark.length} / {REMARK_MAX} characters</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label text-xs">Approved rank</label>
            <input
              type="text"
              className="input"
              value={draft.approvedRank}
              disabled={disabled}
              onChange={(e) => onChange({ approvedRank: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-400">The grade being taken.</p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="grow">
              <span className="label text-xs">Examiner</span>
              <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{examinerName}</p>
            </div>
            <div className="pb-1">
              <span className="label text-xs">Result</span>
              <div className="flex gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={passed}
                    disabled={disabled}
                    onChange={(e) => onChange({ passed: e.target.checked })}
                  />
                  Passed
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={!passed}
                    disabled={disabled}
                    onChange={(e) => onChange({ passed: !e.target.checked })}
                  />
                  Failed
                </label>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Ticked from the mark — {PASS_MARK} and above passes.
            {overridden && <span className="ml-1 font-medium text-amber-700">Set by hand, against the mark.</span>}
          </p>

          <ExaminerSignature
            value={draft.examinerSignature}
            disabled={disabled}
            onChange={(png) => onChange({ examinerSignature: png })}
          />
        </div>
      </div>
    </div>
  );
}

/** Pattern and Step-Sparring: pick what was performed, mark it, add another. */
function SelectRows({
  component,
  rows,
  disabled,
  onChange,
}: {
  component: SheetComponent;
  rows: SelectedRow[];
  disabled: boolean;
  onChange: (rows: SelectedRow[]) => void;
}) {
  // Always show one empty row beyond what's filled in, so there is never a
  // button to press before the next thing can be recorded.
  const shown: SelectedRow[] = [...rows];
  while (shown.length < Math.max(component.minRows ?? 2, rows.length + 1)) shown.push({ item: "", score: null });

  const taken = new Set(rows.map((r) => r.item).filter(Boolean));

  function update(index: number, patch: Partial<SelectedRow>) {
    const next = shown.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange(next.filter((r) => r.item || r.score != null));
  }

  return (
    <div className="space-y-1">
      {shown.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            className="input !w-56 !py-1 text-xs"
            value={row.item}
            disabled={disabled}
            onChange={(e) => update(i, { item: e.target.value })}
          >
            <option value="">{i < (component.minRows ?? 2) ? "Choose…" : "Add another…"}</option>
            {component.items
              .filter((item) => item.key === row.item || !taken.has(item.key))
              .map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
          </select>
          <input
            type="number"
            min={0}
            max={component.itemMax}
            step="0.5"
            className="input !w-20 !px-1 !py-1 text-center text-xs"
            placeholder={`0-${component.itemMax}`}
            value={row.score ?? ""}
            disabled={disabled || !row.item}
            aria-label={`Mark for ${row.item ? itemLabel(component, row.item) : "this row"}`}
            onChange={(e) => update(i, { score: e.target.value === "" ? null : Number(e.target.value) })}
          />
          {row.item && !disabled && (
            <button
              type="button"
              className="text-xs font-medium text-red-600 hover:underline"
              onClick={() => onChange(shown.filter((_, j) => j !== i).filter((r) => r.item || r.score != null))}
            >
              Remove
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Power breaking: three chosen techniques, three attempts each. */
function BreakingRows({
  component,
  marks,
  disabled,
  onScore,
  onMethod,
}: {
  component: SheetComponent;
  marks: SheetMarks;
  disabled: boolean;
  onScore: (key: string, value: string) => void;
  onMethod: (key: string, value: string) => void;
}) {
  const methods = component.methods ?? 3;
  const attempts = component.attempts ?? 3;
  const groups = breakingGroups();

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          <th className="w-6 px-1 py-0.5 text-left text-gray-500"></th>
          <th className="px-1 py-0.5 text-left text-gray-500">Technique</th>
          {BREAKING_ATTEMPTS.slice(0, attempts).map((a) => (
            <th key={a} className="w-20 px-1 py-0.5 text-center text-gray-500">{a}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: methods }, (_, i) => i + 1).map((m) => (
          <tr key={m}>
            <td className="px-1 py-0.5 text-gray-500">{m}</td>
            <td className="px-1 py-0.5">
              <select
                className="input !w-56 !py-1 text-xs"
                value={String(marks[`pb_method_${m}`] ?? "")}
                disabled={disabled}
                onChange={(e) => onMethod(`pb_method_${m}`, e.target.value)}
              >
                <option value="">Choose a technique…</option>
                {groups.map((g) => (
                  <optgroup key={g.launch} label={g.launch}>
                    {g.options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </td>
            {Array.from({ length: attempts }, (_, k) => k + 1).map((a) => (
              <td key={a} className="px-1 py-0.5 text-center">
                <input
                  type="number"
                  min={0}
                  max={component.itemMax}
                  step="0.5"
                  className="input !w-16 !px-1 !py-1 text-center text-xs"
                  value={markValue(marks, `pb_m${m}_a${a}`) ?? ""}
                  disabled={disabled}
                  aria-label={`Method ${m}, attempt ${a}`}
                  onChange={(e) => onScore(`pb_m${m}_a${a}`, e.target.value)}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The examiner's signature, imported from their own account. */
function ExaminerSignature({
  value,
  disabled,
  onChange,
}: {
  value: string | null;
  disabled: boolean;
  onChange: (png: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function importSignature() {
    setBusy(true);
    setMessage("");
    const mine = await loadMySignature();
    setBusy(false);
    if (!mine.signature) {
      setMessage("You haven't drawn a signature yet — add one on the User & Access page.");
      return;
    }
    onChange(mine.signature);
  }

  return (
    <div>
      <span className="label text-xs">Examiner signature</span>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Examiner signature" className="h-16 rounded-md border border-gray-200 bg-white" />
      ) : (
        <p className="rounded-md border border-dashed border-gray-300 px-3 py-3 text-xs text-gray-400">Not signed.</p>
      )}
      {!disabled && (
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-secondary !px-2 !py-1 text-xs" disabled={busy} onClick={() => { void importSignature(); }}>
            {busy ? "Importing..." : "Import my signature"}
          </button>
          {value && (
            <button type="button" className="text-xs font-medium text-gray-500 hover:underline" onClick={() => onChange(null)}>
              Clear
            </button>
          )}
          {message && <span className="text-xs text-amber-700">{message}</span>}
        </div>
      )}
    </div>
  );
}
