"use client";

import { useState } from "react";
import {
  BREAKING_OUTCOMES,
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
import { LIMBS, LAUNCHES, techniquesFor, breakingValue, parseBreakingValue, isCompleteBreakingValue, type Limb } from "@/lib/powerBreaking";
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

/**
 * Power breaking: three chosen techniques, and how each one ended.
 *
 * The technique is picked a level at a time — hand or kick, how it's launched,
 * then the technique — because the third list depends on the first.
 *
 * A technique either breaks on one of three attempts or fails, so the outcome
 * is one choice rather than three ticks. What each is worth depends on how many
 * techniques are being broken, and it's shown next to the choice so the
 * examiner can see the arithmetic rather than take it on trust.
 */
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

  // Only fully-picked techniques count towards the share, so the per-attempt
  // worth doesn't jump about while somebody is still choosing.
  const chosenCount = Array.from({ length: methods }, (_, i) => i + 1).filter((m) =>
    isCompleteBreakingValue(String(marks[`pb_method_${m}`] ?? "")),
  ).length;

  const allBroke =
    chosenCount > 0 &&
    Array.from({ length: methods }, (_, i) => i + 1)
      .filter((m) => isCompleteBreakingValue(String(marks[`pb_method_${m}`] ?? "")))
      .every((m) => {
        const outcome = String(marks[`pb_outcome_${m}`] ?? "");
        return outcome && outcome !== "ftb";
      });

  return (
    <div className="space-y-2">
      {Array.from({ length: methods }, (_, i) => i + 1).map((m) => {
        const choice = parseBreakingValue(String(marks[`pb_method_${m}`] ?? ""));
        const outcome = String(marks[`pb_outcome_${m}`] ?? "");
        const techniques = techniquesFor(choice.limb);

        function setPart(part: Partial<{ limb: Limb | ""; launch: string; technique: string }>) {
          const next = { ...choice, ...part };
          // Changing an earlier level clears what depended on it, so a hand
          // launch can never be left attached to a kick.
          if (part.limb !== undefined) { next.technique = ""; }
          onMethod(`pb_method_${m}`, breakingValue(next.limb, next.launch, next.technique));
        }

        return (
          <div key={m} className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 p-2">
            <span className="w-4 text-xs text-gray-500">{m}</span>

            <select
              className="input !w-28 !py-1 text-xs"
              value={choice.limb}
              disabled={disabled}
              aria-label={`Technique ${m}: hand or kick`}
              onChange={(e) => setPart({ limb: e.target.value as Limb | "" })}
            >
              <option value="">Hand / Kick…</option>
              {LIMBS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>

            {choice.limb && (
              <select
                className="input !w-32 !py-1 text-xs"
                value={choice.launch}
                disabled={disabled}
                aria-label={`Technique ${m}: how it is launched`}
                onChange={(e) => setPart({ launch: e.target.value })}
              >
                <option value="">Launch…</option>
                {LAUNCHES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            )}

            {choice.limb && choice.launch && (
              <select
                className="input !w-48 !py-1 text-xs"
                value={choice.technique}
                disabled={disabled}
                aria-label={`Technique ${m}`}
                onChange={(e) => setPart({ technique: e.target.value })}
              >
                <option value="">Technique…</option>
                {techniques.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}

            {choice.launch && choice.technique && (
              <div className="flex flex-wrap items-center gap-3 border-l border-gray-200 pl-3">
                {/* No per-attempt figure here: what an attempt is worth depends
                    on how many techniques are being broken, and showing four
                    shifting numbers per row invites second-guessing. The
                    component's Alloted mark is the answer. */}
                {BREAKING_OUTCOMES.map((o) => (
                  <label key={o.key} className="flex items-center gap-1 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={outcome === o.key}
                      disabled={disabled}
                      onChange={(e) => onScore(`pb_outcome_${m}`, e.target.checked ? o.key : "")}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <p className="text-xs text-gray-400">
        {chosenCount === 0
          ? "Choose a technique to start marking."
          : `${chosenCount} technique${chosenCount === 1 ? "" : "s"} · the earlier it breaks the more it scores · breaking them all adds a mark.`}
        {allBroke && <span className="ml-1 font-medium text-green-700">All broken — bonus counted.</span>}
      </p>
    </div>
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
